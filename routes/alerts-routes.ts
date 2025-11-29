// src/routes/alertRoutes.ts
// deno-lint-ignore-file no-explicit-any

/**
 * Этот файл определяет API-маршруты (Hono) для CRUD-операций
 * с 'working' алертами (Line и VWAP).
 *
 * Ожидает 'alertStorage' в контексте c.var.
 */
import { Hono } from "npm:hono";
import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { v4 as uuidv4 } from "npm:uuid";

// Определяем тип Hono для 'alertStorage'
type HonoApp = {
  Variables: {
    alertStorage: AlertStorage;
  };
};

export const alertRoutes = new Hono<HonoApp>();

// --- 🚀 LINE ALERTS API ---

// 1. GET /alerts/line (Get All)
alertRoutes.get("/alerts/line", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alerts = await storage.getWorkingLineAlerts();
    return c.json({ success: true, count: alerts.length, data: alerts });
  } catch (e: any) {
    logger.error("[API /alerts/line] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 2. POST /alerts/line (Add One)
alertRoutes.post("/alerts/line", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alert = (await c.req.json()) as LineAlert;
    // Генерируем UUID, если клиент не предоставил
    if (!alert.id) {
      alert.id = uuidv4();
    }
    // Устанавливаем 'isActive' для 'working'
    alert.isActive = true;

    const success = await storage.addWorkingLineAlert(alert);
    return c.json({ success: success, id: alert.id });
  } catch (e: any) {
    logger.error("[API /alerts/line] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 3. POST /alerts/line/batch (Add Many)
alertRoutes.post("/alerts/line/batch", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alerts = (await c.req.json()) as LineAlert[];
    if (!Array.isArray(alerts)) {
      return c.json(
        { success: false, error: "Invalid payload. Array is required." },
        400
      );
    }
    // Присваиваем ID
    alerts.forEach((a) => {
      if (!a.id) a.id = uuidv4();
      a.isActive = true;
    });

    const success = await storage.addWorkingLineAlerts(alerts);
    return c.json({ success: success, count: alerts.length });
  } catch (e: any) {
    logger.error("[API /alerts/line/batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 🔥 КРИТИЧЕСКИ ВАЖНО: /all и /delete-batch ПЕРЕД /:id

// 4. DELETE /alerts/line/all (Delete All)
alertRoutes.delete("/alerts/line/all", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const deletedCount = await storage.removeAllWorkingLineAlerts();
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /alerts/line/all] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 5. POST /alerts/line/delete-batch (Delete Many By ID)
alertRoutes.post("/alerts/line/delete-batch", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const ids = (await c.req.json()) as string[];
    if (!Array.isArray(ids)) {
      return c.json(
        { success: false, error: "Invalid payload. Array of IDs required." },
        400
      );
    }
    const deletedCount = await storage.removeWorkingLineAlertsByIds(ids);
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /alerts/line/delete-batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 6. DELETE /alerts/line/:id (Delete One By ID)
alertRoutes.delete("/alerts/line/:id", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const id = c.req.param("id");
    const success = await storage.removeWorkingLineAlert(id);
    return c.json({ success: success, id: id });
  } catch (e: any) {
    logger.error("[API /alerts/line/:id] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 🚀 VWAP ALERTS API ---

// 1. GET /alerts/vwap (Get All)
alertRoutes.get("/alerts/vwap", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alerts = await storage.getWorkingVwapAlerts();
    return c.json({ success: true, count: alerts.length, data: alerts });
  } catch (e: any) {
    logger.error("[API /alerts/vwap] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 2. POST /alerts/vwap (Add One)
alertRoutes.post("/alerts/vwap", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alert = (await c.req.json()) as VwapAlert;
    if (!alert.id) alert.id = uuidv4();
    alert.isActive = true;

    const success = await storage.addWorkingVwapAlert(alert);
    return c.json({ success: success, id: alert.id });
  } catch (e: any) {
    logger.error("[API /alerts/vwap] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 3. POST /alerts/vwap/batch (Add Many)
alertRoutes.post("/alerts/vwap/batch", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const alerts = (await c.req.json()) as VwapAlert[];
    if (!Array.isArray(alerts)) {
      return c.json(
        { success: false, error: "Invalid payload. Array is required." },
        400
      );
    }
    alerts.forEach((a) => {
      if (!a.id) a.id = uuidv4();
      a.isActive = true;
    });

    const success = await storage.addWorkingVwapAlerts(alerts);
    return c.json({ success: success, count: alerts.length });
  } catch (e: any) {
    logger.error("[API /alerts/vwap/batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 🔥 КРИТИЧЕСКИ ВАЖНО: /all и /delete-batch ПЕРЕД /:id

// 4. DELETE /alerts/vwap/all (Delete All)
alertRoutes.delete("/alerts/vwap/all", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const deletedCount = await storage.removeAllWorkingVwapAlerts();
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /alerts/vwap/all] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 5. POST /alerts/vwap/delete-batch (Delete Many By ID)
alertRoutes.post("/alerts/vwap/delete-batch", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const ids = (await c.req.json()) as string[];
    if (!Array.isArray(ids)) {
      return c.json(
        { success: false, error: "Invalid payload. Array of IDs required." },
        400
      );
    }
    const deletedCount = await storage.removeWorkingVwapAlertsByIds(ids);
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /alerts/vwap/delete-batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// 6. DELETE /alerts/vwap/:id (Delete One By ID)
alertRoutes.delete("/alerts/vwap/:id", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const id = c.req.param("id");
    const success = await storage.removeWorkingVwapAlert(id);
    return c.json({ success: success, id: id });
  } catch (e: any) {
    logger.error("[API /alerts/vwap/:id] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});
