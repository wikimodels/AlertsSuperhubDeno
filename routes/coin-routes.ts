// src/routes/coinRoutes.ts
// deno-lint-ignore-file no-explicit-any

/**
 * API-маршруты для CRUD-операций с 'working-coins'
 * Все роуты начинаются с /coins/working для соответствия Angular environment
 */
import { Hono } from "npm:hono";

import { WorkingCoin } from "../models/working-coin.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";
import { WorkingCoinStorage } from "../working-coin-manager/working-coin-storage.ts";

type HonoApp = {
  Variables: {
    storage: WorkingCoinStorage;
  };
};

export const coinRoutes = new Hono<HonoApp>();

// ============================================
// 📥 GET - Получение монет
// ============================================

/**
 * GET /coins/working
 * Получить все монеты
 */
coinRoutes.get("/coins/working", async (c) => {
  const storage = c.var.storage;
  try {
    const coins = await storage.getAllCoins();
    return c.json({ success: true, count: coins.length, data: coins });
  } catch (e: any) {
    logger.error("[API /coins/working] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================
// ➕ POST - Добавление монет
// ============================================

/**
 * POST /coins/working
 * Добавить одну монету
 */
coinRoutes.post("/coins/working", async (c) => {
  const storage = c.var.storage;
  try {
    const coin = (await c.req.json()) as WorkingCoin;
    if (!coin || !coin.symbol || !coin.exchanges) {
      return c.json(
        {
          success: false,
          error: "Invalid payload. 'symbol' and 'exchanges' are required.",
        },
        400
      );
    }
    const success = await storage.addCoin(coin);

    if (!success) {
      return c.json(
        {
          success: false,
          error: `Coin ${coin.symbol} already exists.`,
        },
        409
      );
    }

    return c.json({ success: true, symbol: coin.symbol });
  } catch (e: any) {
    logger.error("[API /coins/working] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

/**
 * POST /coins/working/batch
 * Добавить массив монет
 */
coinRoutes.post("/coins/working/batch", async (c) => {
  const storage = c.var.storage;
  try {
    const coins = (await c.req.json()) as WorkingCoin[];
    if (!Array.isArray(coins) || coins.length === 0) {
      return c.json(
        {
          success: false,
          error: "Invalid payload. Array of coins is required.",
        },
        400
      );
    }
    const success = await storage.addCoins(coins);
    return c.json({ success: success, count: coins.length });
  } catch (e: any) {
    logger.error("[API /coins/working/batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================
// ❌ DELETE - Удаление монет
// ============================================
// 🔥 ВАЖНО: /all ДОЛЖЕН БЫТЬ ПЕРЕД /:symbol

/**
 * DELETE /coins/working/all
 * Удалить ВСЕ монеты
 */
coinRoutes.delete("/coins/working/all", async (c) => {
  const storage = c.var.storage;
  try {
    const deletedCount = await storage.removeAllCoins();
    logger.info(
      `[API /coins/working/all] All ${deletedCount} coins removed.`,
      DColors.yellow
    );
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /coins/working/all] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

/**
 * DELETE /coins/working/:symbol
 * Удалить одну монету по символу
 */
coinRoutes.delete("/coins/working/:symbol", async (c) => {
  const storage = c.var.storage;
  try {
    const symbol = c.req.param("symbol");
    if (!symbol) {
      return c.json(
        { success: false, error: "Symbol parameter is required." },
        400
      );
    }
    const success = await storage.removeCoin(symbol.toUpperCase());

    if (!success) {
      return c.json(
        { success: false, error: `Coin ${symbol} not found.` },
        404
      );
    }

    return c.json({ success: true, symbol: symbol });
  } catch (e: any) {
    logger.error("[API /coins/working/:symbol] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

/**
 * POST /coins/working/delete-batch
 * Удалить массив монет по символам
 */
coinRoutes.post("/coins/working/delete-batch", async (c) => {
  const storage = c.var.storage;
  try {
    const symbols = (await c.req.json()) as string[];
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return c.json(
        {
          success: false,
          error: "Invalid payload. Array of symbols is required.",
        },
        400
      );
    }
    const deletedCount = await storage.removeCoins(symbols);
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /coins/working/delete-batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});
