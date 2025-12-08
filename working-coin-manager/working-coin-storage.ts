// src/coin-manager/workingCoinStorage.ts
// deno-lint-ignore-file no-explicit-any

/**
 * Этот модуль предоставляет CRUD-сервис для коллекции 'working-coins'.
 * Он ПОЛНОСТЬЮ НЕЗАВИСИМ от 'alert-manager' и 'jobs'.
 * Он используется API-роутером для управления списком отслеживаемых монет.
 */
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { MongoClient, Db, Collection } from "npm:mongodb";
import { WorkingCoin } from "../models/working-coin.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

// --- Константы ---
const env = await load();
const MONGO_URL = env["MONGO_DB_URL"] ?? Deno.env.get("MONGO_DB_URL");
const DB_NAME = "general";
const WORKING_COINS_COLLECTION = "working-coins";

/**
 * Класс для управления списком "рабочих" монет в MongoDB.
 * Использует upsert для автоматической перезаписи существующих монет.
 */
export class WorkingCoinStorage {
  private client: MongoClient;
  private db: Db;
  private workingCoinsCol: Collection<WorkingCoin>;

  constructor() {
    if (!MONGO_URL) {
      logger.error(
        "Не найден 'MONGO_DB_URL' в .env. WorkingCoinStorage не может запуститься."
      );
      throw new Error("MONGO_DB_URL не настроен.");
    }
    this.client = new MongoClient(MONGO_URL);
    this.db = this.client.db(DB_NAME);
    this.workingCoinsCol = this.db.collection<WorkingCoin>(
      WORKING_COINS_COLLECTION
    );
  }

  /**
   * Подключается к MongoDB.
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();

      // Создаем уникальный индекс по symbol для эффективного upsert
      await this.workingCoinsCol.createIndex({ symbol: 1 }, { unique: true });

      logger.info(
        "WorkingCoinStorage успешно подключен к MongoDB.",
        DColors.green
      );
    } catch (e) {
      logger.error("WorkingCoinStorage: Не удалось подключиться к MongoDB:", e);
      throw e;
    }
  }

  /**
   * Отключается от MongoDB.
   */
  async disconnect(): Promise<void> {
    await this.client.close();
    logger.info("WorkingCoinStorage отключен от MongoDB.", DColors.gray);
  }

  // --- CRUD (по вашему списку) ---

  /**
   * Добавляет или обновляет одну монету в 'working-coins'.
   * Использует upsert: если монета существует - перезаписывает, если нет - создает новую.
   */
  async addCoin(coin: WorkingCoin): Promise<boolean> {
    try {
      const result = await this.workingCoinsCol.updateOne(
        { symbol: coin.symbol },
        { $set: coin },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        logger.info(
          `[WorkingCoins] Монета ${coin.symbol} добавлена.`,
          DColors.green
        );
      } else if (result.modifiedCount > 0) {
        logger.info(
          `[WorkingCoins] Монета ${coin.symbol} обновлена.`,
          DColors.cyan
        );
      } else {
        logger.info(
          `[WorkingCoins] Монета ${coin.symbol} не изменилась (данные идентичны).`,
          DColors.gray
        );
      }

      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить/обновить монету ${coin.symbol}: ${e.message}`,
        e
      );
      return false;
    }
  }

  /**
   * Добавляет или обновляет массив монет в 'working-coins'.
   * Использует bulkWrite для эффективной пакетной операции с upsert.
   */
  async addCoins(coins: WorkingCoin[]): Promise<boolean> {
    if (!coins || coins.length === 0) return true;

    try {
      // Создаем массив операций bulkWrite с upsert
      const operations = coins.map((coin) => ({
        updateOne: {
          filter: { symbol: coin.symbol },
          update: { $set: coin },
          upsert: true,
        },
      }));

      const result = await this.workingCoinsCol.bulkWrite(operations, {
        ordered: false, // Продолжаем даже если одна операция провалилась
      });

      logger.info(
        `[WorkingCoins] Пакетная операция: добавлено ${
          result.upsertedCount
        }, обновлено ${result.modifiedCount}, без изменений ${
          coins.length - result.upsertedCount - result.modifiedCount
        }.`,
        DColors.green
      );

      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить/обновить массив монет: ${e.message}`,
        e
      );
      return false;
    }
  }

  /**
   * Удаляет одну монету по символу.
   */
  async removeCoin(symbol: string): Promise<boolean> {
    try {
      const result = await this.workingCoinsCol.deleteOne({ symbol: symbol });

      if (result.deletedCount > 0) {
        logger.info(`[WorkingCoins] Монета ${symbol} удалена.`, DColors.yellow);
      } else {
        logger.warn(
          `[WorkingCoins] Монета ${symbol} не найдена для удаления.`,
          DColors.yellow
        );
      }

      return result.deletedCount > 0;
    } catch (e: any) {
      logger.error(`Не удалось удалить монету ${symbol}: ${e.message}`, e);
      return false;
    }
  }

  /**
   * Удаляет массив монет по списку символов.
   */
  async removeCoins(symbols: string[]): Promise<number> {
    if (!symbols || symbols.length === 0) return 0;

    try {
      const result = await this.workingCoinsCol.deleteMany({
        symbol: { $in: symbols },
      });

      logger.info(
        `[WorkingCoins] Удалено ${result.deletedCount} монет из ${symbols.length} запрошенных.`,
        DColors.yellow
      );

      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось удалить массив монет: ${e.message}`, e);
      return 0;
    }
  }

  /**
   * Получает все монеты из 'working-coins'.
   */
  async getAllCoins(): Promise<WorkingCoin[]> {
    try {
      const coins = await this.workingCoinsCol.find().toArray();
      logger.info(
        `[WorkingCoins] Получено ${coins.length} монет.`,
        DColors.gray
      );
      return coins;
    } catch (e: any) {
      logger.error(`Не удалось получить все монеты: ${e.message}`, e);
      return [];
    }
  }

  /**
   * Удаляет ВСЕ монеты из 'working-coins'.
   */
  async removeAllCoins(): Promise<number> {
    try {
      const result = await this.workingCoinsCol.deleteMany({});
      logger.warn(
        `[WorkingCoins] УДАЛЕНЫ ВСЕ МОНЕТЫ (${result.deletedCount}).`,
        DColors.red
      );
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось очистить working-coins: ${e.message}`, e);
      return 0;
    }
  }

  /**
   * Получает количество монет в коллекции.
   */
  async getCoinsCount(): Promise<number> {
    try {
      const count = await this.workingCoinsCol.countDocuments();
      return count;
    } catch (e: any) {
      logger.error(`Не удалось получить количество монет: ${e.message}`, e);
      return 0;
    }
  }

  /**
   * Проверяет, существует ли монета по символу.
   */
  async coinExists(symbol: string): Promise<boolean> {
    try {
      const count = await this.workingCoinsCol.countDocuments({
        symbol: symbol,
      });
      return count > 0;
    } catch (e: any) {
      logger.error(
        `Не удалось проверить существование монеты ${symbol}: ${e.message}`,
        e
      );
      return false;
    }
  }

  /**
   * Получает одну монету по символу.
   */
  async getCoinBySymbol(symbol: string): Promise<WorkingCoin | null> {
    try {
      const coin = await this.workingCoinsCol.findOne({ symbol: symbol });
      return coin || null;
    } catch (e: any) {
      logger.error(`Не удалось получить монету ${symbol}: ${e.message}`, e);
      return null;
    }
  }
}
