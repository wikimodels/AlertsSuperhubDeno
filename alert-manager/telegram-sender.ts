// deno-lint-ignore-file no-explicit-any
// src/alertManager/telegramSender.ts

import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";
import { logger } from "../utils/logger.ts";
import { DColors } from "../models/types.ts";

const env = await load();
const TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage";
const TRIGGERED_SITE_URL = env["TRIGGERED_ALERTS_SITE"] ?? Deno.env.get("TRIGGERED_ALERTS_SITE") ?? "https://alerts-superhub-mobile.web.app";

// --- Хелперы форматирования ---

function _getTradingViewLink(symbol: string, exchanges: string[] = []): string {
  const suffix = symbol.endsWith(".P") ? "" : ".P";

  if (!exchanges || exchanges.length === 0) {
    return `https://www.tradingview.com/chart/?symbol=${symbol}${suffix}`;
  }

  const priority = ["BYBIT", "BINANCE"];
  let bestExchange = "BINANCE";
  for (const ex of priority) {
    if (exchanges.includes(ex)) {
      bestExchange = ex;
      break;
    }
  }

  const tvSymbol = `${bestExchange}:${symbol}${suffix}`;
  return `https://www.tradingview.com/chart/?symbol=${tvSymbol}`;
}

function _formatReportTime(): string {
  const dt = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const timeStr = new Intl.DateTimeFormat("sv-SE", options).format(dt);
  return `🕒 ${timeStr} <a href="${TRIGGERED_SITE_URL}">🈸🈸</a>`;
}

function _formatVwapReportTime(): string {
  const dt = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const timeStr = new Intl.DateTimeFormat("sv-SE", options).format(dt);
  return `🕒 ${timeStr} <a href="${TRIGGERED_SITE_URL}">🈯️🈯️</a>`;
}

function _formatCombinedReportTime(): string {
  const dt = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const timeStr = new Intl.DateTimeFormat("sv-SE", options).format(dt);
  return `🕒 ${timeStr} <a href="${TRIGGERED_SITE_URL}">🈸🈯️</a>`;
}

// Форматирование времени якоря для VWAP
function _formatAnchorTime(isoStr: string): string {
  if (!isoStr || isoStr === "N/A") return "N/A";
  try {
    const dt = new Date(isoStr);
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
    return new Intl.DateTimeFormat("sv-SE", options).format(dt);
  } catch {
    return isoStr;
  }
}

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

async function _sendTgMessage(msg: string, parse_mode = "HTML"): Promise<void> {
  try {
    const botToken = env["TG_BOT_TOKEN"] ?? Deno.env.get("TG_BOT_TOKEN_KEY");
    const chatId = env["TG_USER"] ?? Deno.env.get("TG_USER_KEY");

    if (!botToken || !chatId) {
      logger.error(
        "Не настроены TG_BOT_TOKEN или TG_USER. Отправка невозможна."
      );
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 секунд на жесткий таймаут
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Ошибка отправки в TG: ${response.status} - ${errorText}`);
    } else {
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

export async function sendTriggeredLineAlertsReport(
  alerts: LineAlert[]
): Promise<void> {
  let msg: string;
  if (!alerts || alerts.length === 0) {
    msg = "<b>✴️ LINE ALERTS (1h): NO TRIGGERED ALERTS</b>";
  } else {
    // 🚀 Сортировка по алфавиту
    alerts.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

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

export async function sendTriggeredVwapAlertsReport(
  alerts: VwapAlert[]
): Promise<void> {
  let msg: string;
  if (!alerts || alerts.length === 0) {
    msg = "<b>💹 VWAP ALERTS (1h): NO TRIGGERED ALERTS</b>";
  } else {
    // 🚀 Сортировка по алфавиту
    alerts.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

    const alertItems = alerts.map((alert, i) => {
      const symbol = alert.symbol || "N/A";
      const tvLink = _getTradingViewLink(symbol, alert.exchanges || []);

      const rawTime = alert.anchorTimeStr || "N/A";
      const anchorTimeStr = _formatAnchorTime(rawTime);

      const symbolShort = symbol.replace("USDT", "").replace("PERP", "");

      return `<a href="${tvLink}"><b>${i + 1
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

// --- СВОДНЫЙ ОТЧЕТ ---
export async function sendCombinedReport(
  lineAlerts: LineAlert[],
  vwapAlerts: VwapAlert[]
): Promise<void> {
  const hasLineAlerts = lineAlerts && lineAlerts.length > 0;
  const hasVwapAlerts = vwapAlerts && vwapAlerts.length > 0;

  if (!hasLineAlerts && !hasVwapAlerts) {
    return;
  }

  const messageParts: string[] = [];

  // 1. Line Alerts
  if (hasLineAlerts) {
    // 🚀 Сортировка по алфавиту
    lineAlerts.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

    const lineItems = lineAlerts.map((alert, i) => {
      const tvLink = _getTradingViewLink(alert.symbol, alert.exchanges || []);
      const alertName = alert.alertName || "N/A";
      const safeName = _escapeHtml(alertName);
      return `<a href="${tvLink}"><b>${i + 1}. <i>${safeName}</i></b></a>`;
    });
    const alertListStr = lineItems.join("\n");
    messageParts.push(`<b>✴️ LINE ALERTS (1h)</b>\n${alertListStr}`);
  }

  // 2. VWAP Alerts
  if (hasVwapAlerts) {
    // 🚀 Сортировка по алфавиту
    vwapAlerts.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

    const vwapItems = vwapAlerts.map((alert, i) => {
      const symbol = alert.symbol || "N/A";
      const tvLink = _getTradingViewLink(symbol, alert.exchanges || []);

      const rawTime = alert.anchorTimeStr || "N/A";
      const anchorTimeStr = _formatAnchorTime(rawTime);

      const symbolShort = symbol.replace("USDT", "").replace("PERP", "");
      return `<a href="${tvLink}"><b>${i + 1
        }. ${symbolShort}/<i>${anchorTimeStr}</i></b></a>`;
    });
    const alertListStr = vwapItems.join("\n");
    messageParts.push(`<b>💹 VWAP ALERTS (1h)</b>\n${alertListStr}`);
  }

  const reportTimeStr = _formatCombinedReportTime();
  const msg = messageParts.join("\n\n") + `\n\n${reportTimeStr}`;

  await _sendTgMessage(msg.trim());
}
