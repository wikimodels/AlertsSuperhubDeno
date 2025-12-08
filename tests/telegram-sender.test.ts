// tests/telegram-sender.test.ts
// deno-lint-ignore-file no-explicit-any
import { sendCombinedReport } from "../alert-manager/telegram-sender.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";

/**
 * ВНИМАНИЕ: ЭТОТ ТЕСТ НЕ ПРОВЕРЯЕТ ЛОГИКУ.
 * * Его задача - вызвать настоящую функцию sendCombinedReport
 * и отправить РЕАЛЬНОЕ сообщение в Telegram для визуальной
 * проверки форматирования.
 *
 * Убедитесь, что .env содержит TG_BOT_TOKEN_KEY и TG_USER_KEY.
 */

// --- Моковые данные ---

const MOCK_LINE_ALERTS: LineAlert[] = [
  {
    id: "line-1",
    symbol: "BTCUSDT",
    alertName: "Прорыв 100k",
    action: "BUY",
    price: 100000,
    exchanges: ["BINANCE", "BYBIT"],
    isActive: true,
    category: 1,
  },
  {
    id: "line-2",
    symbol: "ETHUSDT",
    alertName: "Тест ETH",
    action: "SELL",
    price: 4000,
    exchanges: ["BINANCE"],
    isActive: true,
    category: 1,
  },
];

const MOCK_VWAP_ALERTS: VwapAlert[] = [
  {
    id: "vwap-1",
    symbol: "SOLUSDT",
    alertName: "VWAP SOL 1h",
    action: "BUY",
    price: 150.12, // (Цена срабатывания)
    exchanges: ["BYBIT"],
    isActive: true,
    category: 2,
    anchorTime: 1700000000000,
    anchorTimeStr: "10:00:00", // (Время якоря)
    anchorPrice: 150.12,
  },
];

// --- Тесты ---

Deno.test("Telegram Report - 1. ONLY Line Alerts", async () => {
  console.log("\n--- [Тест 1] ---");
  console.log("Отправка отчета: ТОЛЬКО Line Alerts...");
  await sendCombinedReport(MOCK_LINE_ALERTS, []);
  console.log("Тест 1: Сообщение должно быть отправлено в Telegram.");
});

Deno.test("Telegram Report - 2. ONLY VWAP Alerts", async () => {
  console.log("\n--- [Тест 2] ---");
  console.log("Отправка отчета: ТОЛЬКО VWAP Alerts...");
  await sendCombinedReport([], MOCK_VWAP_ALERTS);
  console.log("Тест 2: Сообщение должно быть отправлено в Telegram.");
});

Deno.test("Telegram Report - 3. BOTH Line and VWAP Alerts", async () => {
  console.log("\n--- [Тест 3] ---");
  console.log("Отправка отчета: СВОДНЫЙ (Line + VWAP)...");
  await sendCombinedReport(MOCK_LINE_ALERTS, MOCK_VWAP_ALERTS);
  console.log("Тест 3: Сообщение должно быть отправлено в Telegram.");
});
