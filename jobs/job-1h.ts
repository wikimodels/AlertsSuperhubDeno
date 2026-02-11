// deno-lint-ignore-file no-explicit-any
import { fetchKlineData } from "../kline-manager/fetchers/kline-fetchers.ts";
import { DColors, JobResult, TF } from "../models/types.ts";
import { logger } from "../utils/logger.ts";
import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { runAlertChecks } from "../alert-manager/alert-checker.ts";

export async function run1hJob(): Promise<JobResult> {
  const startTime = Date.now();
  const timeframe: TF = "1h";

  logger.info(`[JOB 1h] --- STARTING JOB ---`, DColors.cyan);

  const storage = new AlertStorage();

  try {
    // 1. Подключение к БД
    await storage.connect();

    // 2. Получение данных (готовый MarketData Snapshot)
    // Теперь это один запрос к Render API
    const marketData = await fetchKlineData(timeframe);

    if (!marketData) {
      throw new Error(
        "Failed to fetch MarketData snapshot from Render Service."
      );
    }

    // 3. Проверка алертов
    // Передаем полученные данные напрямую в чекер
    if (marketData.coinsNumber > 0) {
      await runAlertChecks(marketData, storage);
    } else {
      logger.warn(
        `[JOB 1h] Snapshot is empty (0 coins). Skipping checks.`,
        DColors.yellow
      );
    }

    const executionTime = Date.now() - startTime;
    logger.info(`[JOB 1h] ✓ Completed in ${executionTime}ms`, DColors.green);

    return {
      success: true,
      timeframe,
      totalCoins: marketData.coinsNumber,
      successfulCoins: marketData.coinsNumber,
      failedCoins: 0, // При работе со снапшотом мы либо получаем всё, либо ничего
      errors: [],
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error(`[JOB 1h] Failed: ${error.message}`, error);

    return {
      success: false,
      timeframe,
      totalCoins: 0,
      successfulCoins: 0,
      failedCoins: 0,
      errors: [error.message],
      executionTime,
    };
  } finally {
    await storage.disconnect();
  }
}
