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
import { CONFIG } from "../config.ts";
import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { runAlertChecks } from "../alert-manager/alert-checker.ts";

export async function run1hJob(): Promise<JobResult> {
  const startTime = Date.now();
  const timeframe: TF = "1h" as TF;
  const errors: string[] = [];

  logger.info(`[JOB 1h] --- STARTING JOB ---`, DColors.cyan);

  // 1. Fetch Coins
  let coins;
  try {
    coins = await fetchCoins();
    logger.info(`[JOB 1h] Fetched ${coins.length} coins.`, DColors.cyan);
  } catch (e: any) {
    logger.error(`[JOB 1h] Coin fetch failed: ${e.message}`);
    return {
      success: false,
      timeframe,
      totalCoins: 0,
      successfulCoins: 0,
      failedCoins: 0,
      errors: [e.message],
      executionTime: 0,
    };
  }

  const storage = new AlertStorage();

  try {
    await storage.connect();

    // DEBUG: Проверяем, есть ли вообще алерты в базе
    const activeLine = await storage.getLineAlerts("working", true);
    const activeVwap = await storage.getVwapAlerts("working", true);
    logger.info(
      `[JOB 1h] Active Alerts in DB -> LINE: ${activeLine.length} | VWAP: ${activeVwap.length}`,
      DColors.yellow
    );

    if (activeLine.length === 0 && activeVwap.length === 0) {
      logger.warn(
        `[JOB 1h] No active alerts found. Job might be useless.`,
        DColors.yellow
      );
    }

    // 2. Split coins
    const coinGroups = splitCoinsByExchange(coins);

    // 3. Fetch Klines
    const kline1hResult = await fetchKlineData(
      coinGroups,
      "1h" as TF,
      CONFIG.KLINE.h1,
      { batchSize: CONFIG.BATCH_SIZE, delayMs: CONFIG.DELAY_MS }
    );

    if (kline1hResult.failed.length > 0) {
      errors.push(
        `1h Kline fetch failed for ${kline1hResult.failed.length} coins`
      );
    }

    // 4. Form MarketData
    const marketData1h: MarketData = {
      timeframe: "1h" as TF,
      openTime: getCurrentCandleTime(TIMEFRAME_MS["1h"]),
      updatedAt: Date.now(),
      coinsNumber: kline1hResult.successful.length,
      data: kline1hResult.successful,
    };

    logger.info(
      `[JOB 1h] Market Data ready with ${marketData1h.coinsNumber} coins.`,
      DColors.cyan
    );

    // 5. Run Checks
    if (marketData1h.coinsNumber > 0) {
      await runAlertChecks(marketData1h, storage);
    } else {
      logger.warn(
        `[JOB 1h] No market data available. Skipping checks.`,
        DColors.yellow
      );
    }

    const executionTime = Date.now() - startTime;
    logger.info(`[JOB 1h] ✓ Completed in ${executionTime}ms`, DColors.green);

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
