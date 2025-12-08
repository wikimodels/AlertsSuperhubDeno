// tests/mocks/telegram-sender.mock.ts

/**
 * Это файл-заглушка (mock) для 'alert-manager/telegram-sender.ts'.
 * Он используется в 'deno.json' (import-map) во время 'deno test',
 * чтобы предотвратить реальные HTTP-запросы к Telegram и ошибки "Leaks detected".
 */
import { LineAlert, VwapAlert } from "../models/alerts.ts";

/**
 * Пустая функция (заглушка). Ничего не делает.
 */
export async function sendTriggeredLineAlertsReport(
  _alerts: LineAlert[]
): Promise<void> {
  // В тестах эта функция ничего не делает
  await Promise.resolve();
}

/**
 * Пустая функция (заглушка). Ничего не делает.
 */
export async function sendTriggeredVwapAlertsReport(
  alerts: VwapAlert[]
): Promise<void> {
  // В тестах эта функция ничего не делает
  await Promise.resolve();
}
