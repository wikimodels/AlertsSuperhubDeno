// deno-lint-ignore-file no-explicit-any
// src/alertManager/alertStorage.ts

/**
 * Этот модуль предоставляет класс AlertStorage для управления алертами
 * в 6 коллекциях (working, triggered, archived).
 *
 * Он также включает CRUD-методы (по аналогии с WorkingCoinStorage)
 * для управления "working" алертами через API.
 */
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { MongoClient, Db, Collection, Filter } from "npm:mongodb";
import { LineAlert, VwapAlert, AlertsCollection } from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

// --- Константы ---
const env = await load();
const MONGO_URL = env["MONGO_DB_URL"] ?? Deno.env.get("MONGO_DB_URL");
const DB_NAME = "general";

const LINE_ALERTS_WORKING_COL = "working-line-alerts";
const LINE_ALERTS_TRIGGERED_COL = "triggered-line-alerts";
const LINE_ALERTS_ARCHIVED_COL = "archived-line-alerts";
const VWAP_ALERTS_WORKING_COL = "working-vwap-alerts";
const VWAP_ALERTS_TRIGGERED_COL = "triggered-vwap-alerts";
const VWAP_ALERTS_ARCHIVED_COL = "archived-vwap-alerts";

export class AlertStorage {
  private client: MongoClient;
  private db: Db;

  // --- 6 свойств коллекций ---
  private lineWorkingCol: Collection<LineAlert>;
  private lineTriggeredCol: Collection<LineAlert>;
  private lineArchivedCol: Collection<LineAlert>;
  private vwapWorkingCol: Collection<VwapAlert>;
  private vwapTriggeredCol: Collection<VwapAlert>;
  private vwapArchivedCol: Collection<VwapAlert>;

  constructor() {
    if (!MONGO_URL) {
      logger.error(
        "Не найден 'MONGO_DB_URL' в .env. AlertStorage не может запуститься."
      );
      throw new Error("MONGO_DB_URL не настроен.");
    }
    this.client = new MongoClient(MONGO_URL);
    this.db = this.client.db(DB_NAME);

    // Инициализация 6 коллекций
    this.lineWorkingCol = this.db.collection<LineAlert>(
      LINE_ALERTS_WORKING_COL
    );
    this.lineTriggeredCol = this.db.collection<LineAlert>(
      LINE_ALERTS_TRIGGERED_COL
    );
    this.lineArchivedCol = this.db.collection<LineAlert>(
      LINE_ALERTS_ARCHIVED_COL
    );
    this.vwapWorkingCol = this.db.collection<VwapAlert>(
      VWAP_ALERTS_WORKING_COL
    );
    this.vwapTriggeredCol = this.db.collection<VwapAlert>(
      VWAP_ALERTS_TRIGGERED_COL
    );
    this.vwapArchivedCol = this.db.collection<VwapAlert>(
      VWAP_ALERTS_ARCHIVED_COL
    );
  }

  /**
   * Подключается к MongoDB.
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info("AlertStorage успешно подключен к MongoDB.", DColors.green);
    } catch (e) {
      logger.error("AlertStorage: Не удалось подключиться к MongoDB:", e);
      throw e;
    }
  }

  /**
   * Отключается от MongoDB.
   */
  async disconnect(): Promise<void> {
    await this.client.close();
    logger.info("AlertStorage отключен от MongoDB.", DColors.gray);
  }

  // --- Хелперы для выбора коллекции (для Checker) ---
  private _getLineCollection(status: AlertsCollection): Collection<LineAlert> {
    switch (status) {
      case "working":
        return this.lineWorkingCol;
      case "triggered":
        return this.lineTriggeredCol;
      case "archived":
        return this.lineArchivedCol;
      default:
        throw new Error(`Неизвестный статус LineAlert: ${status}`);
    }
  }

  private _getVwapCollection(status: AlertsCollection): Collection<VwapAlert> {
    switch (status) {
      case "working":
        return this.vwapWorkingCol;
      case "triggered":
        return this.vwapTriggeredCol;
      case "archived":
        return this.vwapArchivedCol;
      default:
        throw new Error(`Неизвестный статус VwapAlert: ${status}`);
    }
  }

  // --- МЕТОДЫ ДЛЯ ALERT-CHECKER (JOB-1H) ---
  // (Эти методы используются джобом, не API)

  async getLineAlerts(
    status: AlertsCollection,
    isActive = true
  ): Promise<LineAlert[]> {
    // ... (без изменений)
    try {
      const collection = this._getLineCollection(status);
      const filter: Filter<LineAlert> = {
        isActive: isActive,
      };
      return await collection.find(filter).toArray();
    } catch (e: any) {
      logger.error(
        `Не удалось получить Line Alerts (status=${status}): ${e.message}`,
        e
      );
      return [];
    }
  }

  async addLineAlert(
    status: AlertsCollection,
    alert: LineAlert
  ): Promise<boolean> {
    // ... (без изменений, используется для 'triggered')
    try {
      const collection = this._getLineCollection(status);
      await collection.insertOne(alert);
      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить Line Alert (id=${alert.id}) в ${status}: ${e.message}`,
        e
      );
      return false;
    }
  }

  // --- 🚀 НАЧАЛО ИСПРАВЛЕНИЯ (TS2339) ---

  /**
   * (Метод для checker) Получает VWAP алерты по статусу
   */
  async getVwapAlerts(
    status: AlertsCollection,
    isActive = true
  ): Promise<VwapAlert[]> {
    try {
      const collection = this._getVwapCollection(status);
      const filter: Filter<VwapAlert> = {
        isActive: isActive,
      };
      return await collection.find(filter).toArray();
    } catch (e: any) {
      logger.error(
        `Не удалось получить Vwap Alerts (status=${status}): ${e.message}`,
        e
      );
      return [];
    }
  }

  /**
   * (Метод для checker) Добавляет VWAP алерт (обычно 'triggered')
   */
  async addVwapAlert(
    status: AlertsCollection,
    alert: VwapAlert
  ): Promise<boolean> {
    try {
      const collection = this._getVwapCollection(status);
      await collection.insertOne(alert);
      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить Vwap Alert (id=${alert.id}) в ${status}: ${e.message}`,
        e
      );
      return false;
    }
  }

  // --- 🚀 КОНЕЦ ИСПРАВЛЕНИЯ ---

  // --- 🚀 НАЧАЛО: API CRUD (Working Alerts) ---
  // (Этот код из вашего файла остается БЕЗ ИЗМЕНЕНИЙ)

  // --- Line Alerts (CRUD) ---

  async getWorkingLineAlerts(): Promise<LineAlert[]> {
    return await this.lineWorkingCol.find().toArray();
  }

  async addWorkingLineAlert(alert: LineAlert): Promise<boolean> {
    try {
      // Алерт должен иметь 'id' (UUID), заданный клиентом
      if (!alert.id) throw new Error("Alert 'id' (UUID) is required.");

      const existing = await this.lineWorkingCol.findOne({ id: alert.id });
      if (existing) {
        logger.warn(
          `[AlertStorage] Line Alert (id=${alert.id}) уже существует.`,
          DColors.yellow
        );
        return false;
      }
      await this.lineWorkingCol.insertOne(alert);
      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить Line Alert (id=${alert.id}): ${e.message}`,
        e
      );
      return false;
    }
  }

  async addWorkingLineAlerts(alerts: LineAlert[]): Promise<boolean> {
    if (!alerts || alerts.length === 0) return true;
    try {
      await this.lineWorkingCol.insertMany(alerts, { ordered: false });
      return true;
    } catch (e: any) {
      if (e.code === 11000) return true; // Игнорируем дубликаты
      logger.error(`Не удалось добавить массив Line Alerts: ${e.message}`, e);
      return false;
    }
  }

  async removeWorkingLineAlert(id: string): Promise<boolean> {
    try {
      const result = await this.lineWorkingCol.deleteOne({ id: id });
      return result.deletedCount > 0;
    } catch (e: any) {
      logger.error(`Не удалось удалить Line Alert (id=${id}): ${e.message}`, e);
      return false;
    }
  }

  async removeWorkingLineAlertsByIds(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    try {
      const result = await this.lineWorkingCol.deleteMany({ id: { $in: ids } });
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось удалить массив Line Alerts: ${e.message}`, e);
      return 0;
    }
  }

  async removeAllWorkingLineAlerts(): Promise<number> {
    try {
      const result = await this.lineWorkingCol.deleteMany({});
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось очистить working-line-alerts: ${e.message}`, e);
      return 0;
    }
  }

  // --- VWAP Alerts (CRUD) ---

  async getWorkingVwapAlerts(): Promise<VwapAlert[]> {
    return await this.vwapWorkingCol.find().toArray();
  }

  async addWorkingVwapAlert(alert: VwapAlert): Promise<boolean> {
    try {
      if (!alert.id) throw new Error("Alert 'id' (UUID) is required.");

      const existing = await this.vwapWorkingCol.findOne({ id: alert.id });
      if (existing) {
        logger.warn(
          `[AlertStorage] VWAP Alert (id=${alert.id}) уже существует.`,
          DColors.yellow
        );
        return false;
      }
      await this.vwapWorkingCol.insertOne(alert);
      return true;
    } catch (e: any) {
      logger.error(
        `Не удалось добавить VWAP Alert (id=${alert.id}): ${e.message}`,
        e
      );
      return false;
    }
  }

  async addWorkingVwapAlerts(alerts: VwapAlert[]): Promise<boolean> {
    if (!alerts || alerts.length === 0) return true;
    try {
      await this.vwapWorkingCol.insertMany(alerts, { ordered: false });
      return true;
    } catch (e: any) {
      if (e.code === 11000) return true;
      logger.error(`Не удалось добавить массив VWAP Alerts: ${e.message}`, e);
      return false;
    }
  }

  async removeWorkingVwapAlert(id: string): Promise<boolean> {
    try {
      const result = await this.vwapWorkingCol.deleteOne({ id: id });
      return result.deletedCount > 0;
    } catch (e: any) {
      logger.error(`Не удалось удалить VWAP Alert (id=${id}): ${e.message}`, e);
      return false;
    }
  }

  async removeWorkingVwapAlertsByIds(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    try {
      const result = await this.vwapWorkingCol.deleteMany({ id: { $in: ids } });
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось удалить массив VWAP Alerts: ${e.message}`, e);
      return 0;
    }
  }

  async removeAllWorkingVwapAlerts(): Promise<number> {
    try {
      const result = await this.vwapWorkingCol.deleteMany({});
      return result.deletedCount;
    } catch (e: any) {
      logger.error(`Не удалось очистить working-vwap-alerts: ${e.message}`, e);
      return 0;
    }
  }
  // --- 🚀 КОНЕЦ: API CRUD ---

  // --- 🚀 НАЧАЛО: МЕТОДЫ ДЛЯ ТЕСТИРОВАНИЯ (Triggered) ---
  // (Этот код из вашего файла остается БЕЗ ИЗМЕНЕНИЙ)

  async getTriggeredLineAlerts(): Promise<LineAlert[]> {
    return await this.lineTriggeredCol.find().toArray();
  }

  async removeAllTriggeredLineAlerts(): Promise<number> {
    try {
      const result = await this.lineTriggeredCol.deleteMany({});
      return result.deletedCount;
    } catch (e: any) {
      logger.error(
        `Не удалось очистить triggered-line-alerts: ${e.message}`,
        e
      );
      return 0;
    }
  }

  async getTriggeredVwapAlerts(): Promise<VwapAlert[]> {
    return await this.vwapTriggeredCol.find().toArray();
  }

  async removeAllTriggeredVwapAlerts(): Promise<number> {
    try {
      const result = await this.vwapTriggeredCol.deleteMany({});
      return result.deletedCount;
    } catch (e: any) {
      logger.error(
        `Не удалось очистить triggered-vwap-alerts: ${e.message}`,
        e
      );
      return 0;
    }
  }
  // --- 🚀 КОНЕЦ: МЕТОДЫ ДЛЯ ТЕСТИРОВАНИЯ ---
}
