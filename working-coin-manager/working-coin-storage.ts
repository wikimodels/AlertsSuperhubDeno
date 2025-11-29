// src/coin-manager/workingCoinStorage.ts
// deno-lint-ignore-file no-explicit-any

/**
 * Этот модуль предоставляет CRUD-сервис для коллекции 'working-coins'.
 * Он ПОЛНОСТЬЮ НЕЗАВИСИМ от 'alert-manager' и 'jobs'.
 * Он используется API-роутером для управления списком отслеживаемых монет.
 */
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { MongoClient, Db, Collection } from "npm:mongodb";
import { WorkingCoin } from "../models/working-coin.ts"; // <-- Используем правильную модель
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

// --- Константы ---
const env = await load();
const MONGO_URL = env["MONGO_DB_URL"] ?? Deno.env.get("MONGO_DB_URL");
const DB_NAME = "general";
const WORKING_COINS_COLLECTION = "working-coins";

/**
 * Класс для управления списком "рабочих" монет в MongoDB.
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
   * Добавляет одну монету в 'working-coins'.
   * (Рекомендуется создать уникальный индекс по 'symbol' в Mongo)
   */
  async addCoin(coin: WorkingCoin): Promise<boolean> {
    try {
      // Проверка на дубликат
      const existing = await this.workingCoinsCol.findOne({
        symbol: coin.symbol,
      });
      if (existing) {
        logger.warn(
          `[WorkingCoins] Монета ${coin.symbol} уже существует.`,
          DColors.yellow
        );
        return false;
      }
      await this.workingCoinsCol.insertOne(coin);
      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить монету ${coin.symbol}: ${e.message}`,
        e
      );
      return false;
    }
  }

  /**
   * Добавляет массив монет в 'working-coins'.
   * Пропускает дубликаты.
   */
  async addCoins(coins: WorkingCoin[]): Promise<boolean> {
    if (!coins || coins.length === 0) return true;
    try {
      // ordered: false - позволяет вставить не-дубликаты, даже если в батче есть дубликаты
      await this.workingCoinsCol.insertMany(coins, { ordered: false });
      return true;
    } catch (e: any) {
      // Ошибки дубликатов будут проигнорированы, но логгируем другие
      if (e.code === 11000) {
        logger.info(
          `[WorkingCoins] При добавлении пачки пропущены дубликаты.`,
          DColors.gray
        );
        return true;
      }
      logger.error(`Не удалось добавить массив монет: ${e.message}`, e);
      return false;
    }
  }

  /**
   * Удаляет одну монету по символу.
   */
  async removeCoin(symbol: string): Promise<boolean> {
    try {
      const result = await this.workingCoinsCol.deleteOne({ symbol: symbol });
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
      return await this.workingCoinsCol.find().toArray();
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
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось очистить working-coins: ${e.message}`, e);
      return 0;
    }
  }
}
