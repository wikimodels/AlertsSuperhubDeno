// src/routes/coinRoutes.ts
// deno-lint-ignore-file no-explicit-any

/**
 * Этот файл определяет API-маршруты (контроллеры) для CRUD-операций
 * с 'working-coins'. Он использует Hono в качестве роутера.
 * Он ОЖИДАЕТ, что 'WorkingCoinStorage' будет передан в 'c.var.storage'.
 */
import { Hono } from "npm:hono";

import { WorkingCoin } from "../models/working-coin.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";
import { WorkingCoinStorage } from "../working-coin-manager/working-coin-storage.ts";

// Определяем тип Hono, чтобы он знал о 'storage' в контексте
type HonoApp = {
  Variables: {
    storage: WorkingCoinStorage;
  };
};

export const coinRoutes = new Hono<HonoApp>();

// --- 1. GET /coins ---
// (Получить все монеты)
coinRoutes.get("/coins", async (c) => {
  const storage = c.var.storage;
  try {
    const coins = await storage.getAllCoins();
    return c.json({ success: true, count: coins.length, data: coins });
  } catch (e: any) {
    logger.error("[API /coins] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 2. POST /coins ---
// (Добавить одну монету)
coinRoutes.post("/coins", async (c) => {
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
    return c.json({ success: success, symbol: coin.symbol });
  } catch (e: any) {
    logger.error("[API /coins] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 3. POST /coins/batch ---
// (Добавить массив монет)
coinRoutes.post("/coins/batch", async (c) => {
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
    logger.error("[API /coins/batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 🔥 КРИТИЧЕСКИ ВАЖНО: /coins/all ДОЛЖЕН БЫТЬ ПЕРЕД /coins/:symbol ---
// Иначе Hono воспримет "all" как параметр :symbol!

// --- 4. DELETE /coins/all ---
// (Удалить ВСЕ монеты)
coinRoutes.delete("/coins/all", async (c) => {
  const storage = c.var.storage;
  try {
    const deletedCount = await storage.removeAllCoins();
    logger.info(
      `[API /coins/all] All ${deletedCount} coins removed.`,
      DColors.yellow
    );
    return c.json({ success: true, deletedCount: deletedCount });
  } catch (e: any) {
    logger.error("[API /coins/all] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 5. DELETE /coins/:symbol ---
// (Удалить одну монету по символу)
coinRoutes.delete("/coins/:symbol", async (c) => {
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
    return c.json({ success: success, symbol: symbol });
  } catch (e: any) {
    logger.error("[API /coins/:symbol] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// --- 6. POST /coins/delete-batch ---
// (Удалить массив монет по символам)
coinRoutes.post("/coins/delete-batch", async (c) => {
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
    logger.error("[API /coins/delete-batch] " + e.message, e);
    return c.json({ success: false, error: e.message }, 500);
  }
});
