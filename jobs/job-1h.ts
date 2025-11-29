// deno-lint-ignore-file no-explicit-any
import { fetchCoins } from "../kline-manager/fetchers/coin-fetcher.ts";
import { fetchKlineData } from "../kline-manager/fetchers/kline-fetchers.ts";

import { DColors, JobResult, MarketData, TF } from "../models/types.ts";
import {
  splitCoinsByExchange,
  getCurrentCandleTime,
  TIMEFRAME_MS,
} from "../utils/helpers.ts";
import { logger } from "../utils/logger.ts";
// --- 🚀 ИЗМЕНЕНИЕ: 'RedisStore' удален ---
import { CONFIG } from "../config.ts";

import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { runAlertChecks } from "../alert-manager/alert-checker.ts";

/**
 * Cron Job для 1h таймфрейма
 *
 * Алгоритм (Упрощенный):
 * 1. Fetch 1h Kline data (CONFIG.KLINE.h1)
 * 2. Run Alert Checks
 */
export async function run1hJob(): Promise<JobResult> {
  const startTime = Date.now();
  const timeframe: TF = "1h" as TF;
  const errors: string[] = [];
  const coins = await fetchCoins();
  logger.info(`[JOB 1h] Starting job for ${coins.length} coins`, DColors.cyan);

  const storage = new AlertStorage();

  try {
    await storage.connect();

    // 1. Split coins by exchange
    const coinGroups = splitCoinsByExchange(coins);

    // 2. Fetch Klines 1h (400 candles)
    const kline1hResult = await fetchKlineData(
      coinGroups,
      "1h" as TF,
      CONFIG.KLINE.h1,
      {
        batchSize: 50,
        delayMs: 100,
      }
    );
    if (kline1hResult.failed.length > 0) {
      errors.push(
        `1h Kline fetch failed for ${kline1hResult.failed.length} coins`
      );
    }

    // 3. Формируем MarketData для Alert Checker
    const marketData1h: MarketData = {
      timeframe: "1h" as TF,
      openTime: getCurrentCandleTime(TIMEFRAME_MS["1h"]),
      updatedAt: Date.now(),
      coinsNumber: kline1hResult.successful.length,
      data: kline1hResult.successful,
    };

    // --- 🚀 ИЗМЕНЕНИЕ: 'RedisStore.save' удален ---

    // 4. Run Alert Checks
    // (Эта функция УЖЕ содержит всю логику:
    //  - Проверка LineAlerts -> Save Triggered -> Send TG
    //  - Проверка VwapAlerts -> Save Triggered -> Send TG)
    if (marketData1h.coinsNumber > 0) {
      logger.info(
        `[JOB 1h] Данные 1h получены. Запуск Alert Checker...`,
        DColors.cyan
      );
      await runAlertChecks(marketData1h, storage);
    } else {
      logger.warn(
        `[JOB 1h] Данные 1h пусты. Проверка алертов пропущена.`,
        DColors.yellow
      );
    }

    const executionTime = Date.now() - startTime;

    logger.info(
      `[JOB 1h] ✓ Completed in ${executionTime}ms | Checked ${kline1hResult.successful.length} coins`,
      DColors.green
    );
    return {
      success: true,
      timeframe,
      totalCoins: coins.length,
      successfulCoins: kline1hResult.successful.length,
      failedCoins: kline1hResult.failed.length,
      errors,
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error(`[JOB 1h] Failed: ${error.message}`, error);
    return {
      success: false,
      timeframe,
      totalCoins: coins.length,
      successfulCoins: 0,
      failedCoins: coins.length,
      errors: [error.message, ...errors],
      executionTime,
    };
  } finally {
    await storage.disconnect();
  }
}
