// deno-lint-ignore-file no-explicit-any
// src/jobs/job-cleanup.ts

import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

// Конфигурация: 3 суток
const CLEANUP_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export async function runCleanupJob() {
  const startTime = Date.now();
  logger.info(`[JOB Cleanup] --- ЗАПУСК ОЧИСТКИ ---`, DColors.cyan);

  const storage = new AlertStorage();

  try {
    await storage.connect();

    // 1. Чистим Line Alerts
    const deletedLines = await storage.cleanOldTriggeredAlerts(
      "line",
      CLEANUP_AGE_MS
    );

    // 2. Чистим VWAP Alerts
    const deletedVwaps = await storage.cleanOldTriggeredAlerts(
      "vwap",
      CLEANUP_AGE_MS
    );

    const total = deletedLines + deletedVwaps;
    const executionTime = Date.now() - startTime;

    logger.info(
      `[JOB Cleanup] ✓ Завершено за ${executionTime}ms. Всего удалено: ${total} (Line: ${deletedLines}, VWAP: ${deletedVwaps})`,
      DColors.green
    );

    return { success: true, deleted: total };
  } catch (error: any) {
    logger.error(`[JOB Cleanup] Ошибка: ${error.message}`, error);
    return { success: false, error: error.message };
  } finally {
    await storage.disconnect();
  }
}
