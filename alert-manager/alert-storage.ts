// deno-lint-ignore-file no-explicit-any
// src/alertManager/alertStorage.ts

import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { MongoClient, Db, Collection } from "npm:mongodb";
import {
  LineAlert,
  VwapAlert,
  AlertType,
  AlertStatus,
} from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

const env = await load();
const MONGO_URL = env["MONGO_DB_URL"] ?? Deno.env.get("MONGO_DB_URL");
const DB_NAME = "general";

const COLS = {
  line: {
    working: "working-line-alerts",
    triggered: "triggered-line-alerts",
    archived: "archived-line-alerts",
  },
  vwap: {
    working: "working-vwap-alerts",
    triggered: "triggered-vwap-alerts",
    archived: "archived-vwap-alerts",
  },
};

const ALLOWED_EMAILS_COL = "allowed-emails";

export class AlertStorage {
  private client: MongoClient;
  private db: Db;

  private collections: Record<string, Collection<any>> = {};
  private allowedEmailsCol: Collection<any>;

  constructor() {
    if (!MONGO_URL) {
      logger.error("Не найден 'MONGO_DB_URL' в .env.");
      throw new Error("MONGO_DB_URL не настроен.");
    }
    this.client = new MongoClient(MONGO_URL);
    this.db = this.client.db(DB_NAME);

    // Init Collections
    this.collections[`line_working`] = this.db.collection<LineAlert>(
      COLS.line.working
    );
    this.collections[`line_triggered`] = this.db.collection<LineAlert>(
      COLS.line.triggered
    );
    this.collections[`line_archived`] = this.db.collection<LineAlert>(
      COLS.line.archived
    );

    this.collections[`vwap_working`] = this.db.collection<VwapAlert>(
      COLS.vwap.working
    );
    this.collections[`vwap_triggered`] = this.db.collection<VwapAlert>(
      COLS.vwap.triggered
    );
    this.collections[`vwap_archived`] = this.db.collection<VwapAlert>(
      COLS.vwap.archived
    );

    this.allowedEmailsCol = this.db.collection(ALLOWED_EMAILS_COL);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.success(
        "AlertStorage успешно подключен к MongoDB.",
        DColors.green
      );
    } catch (e) {
      logger.error("AlertStorage: Не удалось подключиться к MongoDB", e);
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    logger.info("AlertStorage отключен от MongoDB.", DColors.gray);
  }

  // --- Helper ---
  private _getCollection(
    type: AlertType,
    status: AlertStatus
  ): Collection<any> {
    const key = `${type}_${status}`;
    const col = this.collections[key];
    if (!col) {
      const msg = `Коллекция не найдена для: ${type} / ${status}`;
      logger.error(msg);
      throw new Error(msg);
    }
    return col;
  }

  // --- CRUD ---

  async getAlerts(
    type: AlertType,
    status: AlertStatus,
    isActive?: boolean
  ): Promise<any[]> {
    try {
      const col = this._getCollection(type, status);
      const filter: any = {};
      if (isActive !== undefined) filter.isActive = isActive;
      return await col.find(filter).toArray();
    } catch (e: any) {
      logger.error(
        `Ошибка при получении алертов (${type}/${status}): ${e.message}`,
        e
      );
      return [];
    }
  }

  async addAlert(
    type: AlertType,
    status: AlertStatus,
    alert: any
  ): Promise<boolean> {
    try {
      const col = this._getCollection(type, status);
      if (status === "working" && alert.id) {
        const existing = await col.findOne({ id: alert.id });
        if (existing) {
          logger.warn(
            `Попытка добавить дубликат (${type}/${status}, id=${alert.id})`,
            DColors.yellow
          );
          return false;
        }
      }
      await col.insertOne(alert);
      logger.success(
        `Добавлен алерт (${type}/${status}) Symbol: ${alert.symbol}`,
        DColors.green
      );
      return true;
    } catch (e: any) {
      logger.error(`Ошибка добавления (${type}/${status}): ${e.message}`, e);
      return false;
    }
  }

  async addAlertsBatch(
    type: AlertType,
    status: AlertStatus,
    alerts: any[]
  ): Promise<boolean> {
    if (!alerts.length) return true;
    try {
      const col = this._getCollection(type, status);
      await col.insertMany(alerts, { ordered: false });
      logger.success(
        `Пакетное добавление: ${alerts.length} шт. в (${type}/${status})`,
        DColors.green
      );
      return true;
    } catch (e: any) {
      if (e.code === 11000) return true;
      logger.error(
        `Ошибка пакетного добавления (${type}/${status}): ${e.message}`,
        e
      );
      return false;
    }
  }

  async deleteAlert(
    type: AlertType,
    status: AlertStatus,
    id: string
  ): Promise<boolean> {
    try {
      const col = this._getCollection(type, status);
      const res = await col.deleteOne({ id });
      return res.deletedCount > 0;
    } catch (e: any) {
      logger.error(`Ошибка удаления (${type}/${status}): ${e.message}`, e);
      return false;
    }
  }

  async deleteAlertsBatch(
    type: AlertType,
    status: AlertStatus,
    ids: string[]
  ): Promise<number> {
    try {
      const col = this._getCollection(type, status);
      const res = await col.deleteMany({ id: { $in: ids } });
      logger.info(
        `Пакетное удаление: ${res.deletedCount} из (${type}/${status})`,
        DColors.gray
      );
      return res.deletedCount;
    } catch (e: any) {
      logger.error(
        `Ошибка пакетного удаления (${type}/${status}): ${e.message}`,
        e
      );
      return 0;
    }
  }

  async deleteAllAlerts(type: AlertType, status: AlertStatus): Promise<number> {
    try {
      const col = this._getCollection(type, status);
      const res = await col.deleteMany({});
      return res.deletedCount;
    } catch (e: any) {
      logger.error(
        `Ошибка полной очистки (${type}/${status}): ${e.message}`,
        e
      );
      return 0;
    }
  }

  // ============================================
  // 🔄 UPDATE (PATCH) - UNIVERSAL
  // ============================================
  async updateAlert(
    type: AlertType,
    status: AlertStatus,
    id: string,
    updateData: any
  ): Promise<boolean> {
    try {
      const col = this._getCollection(type, status);

      // Защита: удаляем системные поля, чтобы не сломать базу
      const safeData = { ...updateData };
      delete safeData.id;
      delete safeData._id;

      const result = await col.updateOne({ id: id }, { $set: safeData });

      return result.modifiedCount > 0;
    } catch (e: any) {
      logger.error(
        `Update error (${type}/${status}, id=${id}): ${e.message}`,
        e
      );
      return false;
    }
  }
  // ============================================
  // 📦 UNIVERSAL MOVE (SAFE VERSION)
  // ============================================

  async moveAlerts(
    type: AlertType,
    fromStatus: AlertStatus,
    toStatus: AlertStatus,
    ids: string[]
  ): Promise<number> {
    // 1. Жесткая защита входных данных
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      logger.warn(
        `MoveAlerts: пустой или неверный массив IDs. Type: ${typeof ids}`,
        DColors.yellow
      );
      return 0;
    }

    if (fromStatus === toStatus) return 0;

    try {
      const fromCol = this._getCollection(type, fromStatus);
      const toCol = this._getCollection(type, toStatus);

      // 2. Поиск документов
      const docs = await fromCol.find({ id: { $in: ids } } as any).toArray();

      // 3. Защита от undefined результата базы данных
      if (!docs || docs.length === 0) {
        return 0;
      }

      // 4. Очистка _id
      const docsToInsert = docs.map((doc: any) => {
        const { _id, ...rest } = doc;
        return rest;
      });

      // 5. Вставка
      await toCol.insertMany(docsToInsert as any);

      // 6. Удаление
      const deleteResult = await fromCol.deleteMany({
        id: { $in: ids },
      } as any);

      const movedCount = deleteResult.deletedCount;

      if (movedCount > 0) {
        logger.success(
          `Перемещено ${movedCount} алертов (${type}: ${fromStatus} -> ${toStatus})`,
          DColors.green
        );
      }
      return movedCount;
    } catch (e: any) {
      logger.error(
        `Ошибка перемещения (${type}: ${fromStatus}->${toStatus}): ${e.message}`,
        e
      );
      throw e;
    }
  }

  // ============================================
  // 📧 HELPERS
  // ============================================
  async isEmailAllowed(email: string): Promise<boolean> {
    if (!email) return false;
    const doc = await this.allowedEmailsCol.findOne({
      email: email.toLowerCase().trim(),
    });
    return !!doc;
  }

  // ============================================
  // 🧹 HOUSEKEEPING (CLEANUP)
  // ============================================

  /**
   * Удаляет сработавшие (triggered) алерты, которые старше maxAgeMs
   */
  async cleanOldTriggeredAlerts(
    type: AlertType,
    maxAgeMs: number
  ): Promise<number> {
    try {
      const col = this._getCollection(type, "triggered");

      // Вычисляем пороговое время: Сейчас минус возраст
      const cutoffTime = Date.now() - maxAgeMs;

      // Удаляем всё, где activationTime < cutoffTime
      const res = await col.deleteMany({
        activationTime: { $lt: cutoffTime },
      } as any);

      if (res.deletedCount > 0) {
        logger.info(
          `[CLEANUP] Удалено ${res.deletedCount} старых алертов из (${type}/triggered)`,
          DColors.gray
        );
      }
      return res.deletedCount;
    } catch (e: any) {
      logger.error(`Ошибка очистки старых алертов (${type}): ${e.message}`, e);
      return 0;
    }
  }

  getLineAlerts(status: AlertStatus, isActive = true) {
    return this.getAlerts("line", status, isActive);
  }
  getVwapAlerts(status: AlertStatus, isActive = true) {
    return this.getAlerts("vwap", status, isActive);
  }
  addLineAlert(status: AlertStatus, alert: any) {
    return this.addAlert("line", status, alert);
  }
  addVwapAlert(status: AlertStatus, alert: any) {
    return this.addAlert("vwap", status, alert);
  }
}
