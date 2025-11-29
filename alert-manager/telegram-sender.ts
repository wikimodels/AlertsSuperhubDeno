// deno-lint-ignore-file no-explicit-any
// src/alertManager/telegramSender.ts

/**
 * Этот модуль отвечает за форматирование и отправку
 * уведомлений о сработавших алертах в Telegram.
 *
 * (Портировано из telegram_sender.py)
 */
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

// Загружаем переменные окружения
const env = await load();
const TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage";

// --- Хелперы форматирования (Портировано из Deno и Python) ---

/**
 * (Портировано из get-tv-link.ts / _get_tradingview_link)
 */
function _getTradingViewLink(symbol: string, exchanges: string[] = []): string {
  if (!exchanges || exchanges.length === 0) {
    return `https://www.tradingview.com/chart/?symbol=${symbol}`;
  }

  const priority = ["BYBIT", "BINANCE"];

  // Находим лучшую биржу из списка
  let bestExchange = "BINANCE"; // Фоллбэк
  for (const ex of priority) {
    if (exchanges.includes(ex)) {
      bestExchange = ex;
      break;
    }
  }

  const tvSymbol = `${bestExchange}:${symbol}`;
  return `https://www.tradingview.com/chart/?symbol=${tvSymbol}`;
}

/**
 * (Портировано из _format_report_time)
 * Форматирует время в UTC+3 (МСК)
 */
function _formatReportTime(): string {
  const dt = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow", // UTC+3
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const timeStr = new Intl.DateTimeFormat("sv-SE", options).format(dt);
  return `${timeStr} 🈸🈸🈸`;
}

/**
 * (Портировано из _format_vwap_report_time)
 * Форматирует время в UTC+3 (МСК)
 */
function _formatVwapReportTime(): string {
  const dt = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow", // UTC+3
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const timeStr = new Intl.DateTimeFormat("sv-SE", options).format(dt);
  return `${timeStr} 🈯️🈯️🈯️`;
}

/**
 * (Замена html.escape из Python)
 */
function _escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Основные функции ---

/**
 * (Портировано из _send_tg_message)
 * Отправляет сообщение (АСИНХРОННАЯ ВЕРСИЯ)
 *
 * 🚀 ИСПРАВЛЕНИЕ: Обрабатываем тело ответа для предотвращения resource leaks
 */
async function _sendTgMessage(msg: string, parse_mode = "HTML"): Promise<void> {
  try {
    const botToken = env["TG_BOT_TOKEN"] ?? Deno.env.get("TG_BOT_TOKEN_KEY");
    const chatId = env["TG_USER"] ?? Deno.env.get("TG_USER_KEY");

    if (!botToken) {
      logger.error(
        "Не найден 'TG_BOT_TOKEN_KEY' в .env. Отправка TG невозможна."
      );
      return;
    }
    if (!chatId) {
      logger.error("Не найден 'TG_USER_KEY' в .env. Отправка TG невозможна.");
      return;
    }

    const url = TELEGRAM_API_URL.replace("{token}", botToken);
    const payload = {
      chat_id: chatId,
      text: msg,
      parse_mode: parse_mode,
      disable_web_page_preview: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 🚀 ИСПРАВЛЕНИЕ: ВСЕГДА читаем тело ответа
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Ошибка отправки в TG: ${response.status} - ${errorText}`);
    } else {
      // Читаем и игнорируем тело успешного ответа
      await response.text();
      logger.info(
        "Уведомление о сработавших алертах успешно отправлено в TG.",
        DColors.green
      );
    }
  } catch (e: any) {
    logger.error(`Критическая ошибка при отправке в TG: ${e.message}`, e);
  }
}

/**
 * (Портировано из send_triggered_alerts_report)
 * Форматирует и отправляет отчет о сработавших Line Alerts.
 */
export async function sendTriggeredLineAlertsReport(
  alerts: LineAlert[]
): Promise<void> {
  let msg: string;
  if (!alerts || alerts.length === 0) {
    msg = "<b>✴️ LINE ALERTS (1h): NO TRIGGERED ALERTS</b>";
  } else {
    const alertItems = alerts.map((alert, i) => {
      const tvLink = _getTradingViewLink(alert.symbol, alert.exchanges || []);
      const alertName = alert.alertName || "N/A";
      const safeName = _escapeHtml(alertName);
      return `<a href="${tvLink}"><b>${i + 1}. <i>${safeName}</i></b></a>`;
    });

    const alertListStr = alertItems.join("\n");
    const reportTimeStr = _formatReportTime();

    msg = `
<b>✴️ LINE ALERTS (1h)</b>
${alertListStr}
${reportTimeStr}
`.trim();
  }

  await _sendTgMessage(msg);
}

/**
 * (Портировано из send_triggered_vwap_alerts_report)
 * Форматирует и отправляет отчет о сработавших VWAP Alerts.
 */
export async function sendTriggeredVwapAlertsReport(
  alerts: VwapAlert[]
): Promise<void> {
  let msg: string;
  if (!alerts || alerts.length === 0) {
    msg = "<b>💹 VWAP ALERTS (1h): NO TRIGGERED ALERTS</b>";
  } else {
    const alertItems = alerts.map((alert, i) => {
      const symbol = alert.symbol || "N/A";
      const tvLink = _getTradingViewLink(symbol, alert.exchanges || []);
      const anchorTimeStr = alert.anchorTimeStr || "N/A";

      // (Логика сокращения)
      const symbolShort = symbol.replace("USDT", "").replace("PERP", "");

      return `<a href="${tvLink}"><b>${
        i + 1
      }. ${symbolShort}/<i>${anchorTimeStr}</i></b></a>`;
    });

    const alertListStr = alertItems.join("\n");
    const reportTimeStr = _formatVwapReportTime();

    msg = `
<b>💹 VWAP ALERTS (1h)</b>
${alertListStr}
${reportTimeStr}
`.trim();
  }

  await _sendTgMessage(msg);
}
