// src/routes/alertRoutes.ts
// deno-lint-ignore-file no-explicit-any

import { Hono } from "npm:hono";
import { AlertStorage } from "../alert-manager/alert-storage.ts";
import {
  isAlertType,
  isAlertStatus,
  AlertType,
  AlertStatus,
} from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";
import { v4 as uuidv4 } from "npm:uuid";

type HonoApp = { Variables: { alertStorage: AlertStorage } };
export const alertRoutes = new Hono<HonoApp>();

// Middleware/Helper для валидации параметров
const getParams = (c: any) => {
  const type = c.req.param("type");
  const status = c.req.param("status");
  // Если статус "move", значит мы попали не в тот роут (защита на случай, если порядок снова спутается)
  if (status === "move") return null;

  if (!isAlertType(type) || !isAlertStatus(status)) return null;
  return { type: type as AlertType, status: status as AlertStatus };
};

// ============================================
// 🚨 SPECIFIC ROUTES (MUST BE FIRST)
// ============================================

// 1. POST MOVE (Moved to TOP to avoid collision with /:type/:status)
alertRoutes.post("/alerts/:type/move", async (c) => {
  const type = c.req.param("type");
  if (!isAlertType(type)) return c.json({ error: "Invalid type" }, 400);

  try {
    const { ids, from, to } = await c.req.json();
    if (!ids || !from || !to) return c.json({ error: "Invalid payload" }, 400);

    logger.info(
      `API: Moving ${ids.length} items (${type}: ${from}->${to})`,
      DColors.white
    );
    const count = await c.var.alertStorage.moveAlerts(type, from, to, ids);

    return c.json({ success: true, movedCount: count });
  } catch (e: any) {
    logger.error(`API Error in Move: ${e.message}`, e);
    return c.json({ error: e.message }, 500);
  }
});

// ============================================
// 🧠 GENERIC ROUTES (/:type/:status/...)
// ============================================

// 2. GET ALL
alertRoutes.get("/alerts/:type/:status", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const alerts = await c.var.alertStorage.getAlerts(p.type, p.status);
  return c.json({ success: true, count: alerts.length, data: alerts });
});

// 3. POST ADD ONE
alertRoutes.post("/alerts/:type/:status", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const body = await c.req.json();
  if (!body.id) body.id = uuidv4();
  if (p.status === "working") body.isActive = true;

  logger.info(`API: Adding alert to (${p.type}/${p.status})`, DColors.cyan);
  const success = await c.var.alertStorage.addAlert(p.type, p.status, body);

  return c.json({ success, id: body.id });
});

// 3.1. PATCH UPDATE ONE
alertRoutes.patch("/alerts/:type/:status/:id", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const id = c.req.param("id");
  const body = await c.req.json();

  // Логируем попытку обновления
  logger.info(
    `API: Updating alert (${p.type}/${p.status}) ID: ${id}`,
    DColors.cyan
  );

  const success = await c.var.alertStorage.updateAlert(
    p.type,
    p.status,
    id,
    body
  );

  return c.json({ success, id });
});

// 4. POST BATCH ADD
alertRoutes.post("/alerts/:type/:status/batch", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const alerts = await c.req.json();
  if (!Array.isArray(alerts)) return c.json({ error: "Array required" }, 400);

  alerts.forEach((a: any) => {
    if (!a.id) a.id = uuidv4();
    if (p.status === "working") a.isActive = true;
  });

  logger.info(
    `API: Batch add ${alerts.length} items to (${p.type}/${p.status})`,
    DColors.cyan
  );
  const success = await c.var.alertStorage.addAlertsBatch(
    p.type,
    p.status,
    alerts
  );

  return c.json({ success, count: alerts.length });
});

// 5. POST DELETE BATCH
alertRoutes.post("/alerts/:type/:status/delete-batch", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const ids = await c.req.json();

  logger.info(
    `API: Batch delete ${ids.length} items from (${p.type}/${p.status})`,
    DColors.cyan
  );
  const count = await c.var.alertStorage.deleteAlertsBatch(
    p.type,
    p.status,
    ids
  );

  return c.json({ success: true, deletedCount: count });
});

// 6. DELETE SINGLE
alertRoutes.delete("/alerts/:type/:status/:id", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  const id = c.req.param("id");
  const success = await c.var.alertStorage.deleteAlert(p.type, p.status, id);
  return c.json({ success, id });
});

// 7. DELETE ALL
alertRoutes.delete("/alerts/:type/:status/all", async (c) => {
  const p = getParams(c);
  if (!p) return c.json({ error: "Invalid type or status" }, 400);

  logger.warn(
    `API: Request to DELETE ALL from (${p.type}/${p.status})`,
    DColors.red
  );
  const count = await c.var.alertStorage.deleteAllAlerts(p.type, p.status);
  return c.json({ success: true, deletedCount: count });
});
