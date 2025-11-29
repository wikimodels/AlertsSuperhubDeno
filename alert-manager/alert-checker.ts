// deno-lint-ignore-file no-explicit-any
// src/alertManager/alertChecker.ts

/**
 * Этот модуль портирует 'checker.py'.
 * Он отвечает за запуск проверок Line и VWAP алертов
 * на основе свежих данных Klines.
 */
import { v4 as uuidv4 } from "npm:uuid";
import { AlertStorage } from "./alert-storage.ts";
import {
  sendTriggeredLineAlertsReport,
  sendTriggeredVwapAlertsReport,
} from "./telegram-sender.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";
import { Candle, MarketData, DColors } from "../models/types.ts";
import { logger } from "../utils/logger.ts";

// --- Вспомогательные функции (Портировано из checker.py) ---

/**
 * (Портировано из _unix_to_time_str)
 * Форматирует timestamp (ms) в строку времени UTC+3 (МСК)
 */
function _unix_to_time_str(unix_ms: number): string {
  const dt = new Date(unix_ms);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow", // UTC+3
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("sv-SE", options).format(dt);
}

/**
 * (Портировано из _calculate_vwap)
 * Рассчитывает VWAP на основе предоставленных свечей.
 */
function _calculate_vwap(klines: Candle[]): number {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  for (const kline of klines) {
    try {
      // Убедимся, что все поля существуют и являются числами
      const high = kline.highPrice ?? 0;
      const low = kline.lowPrice ?? 0;
      const close = kline.closePrice ?? 0;
      const volume = kline.volume ?? 0;
      if (volume === 0) continue;

      const typicalPrice = (high + low + close) / 3;
      const priceVolume = typicalPrice * volume;
      cumulativePriceVolume += priceVolume;
      cumulativeVolume += volume;
    } catch {
      continue;
    }
  }

  if (cumulativeVolume === 0) {
    return 0.0;
  }
  return cumulativePriceVolume / cumulativeVolume;
}

/**
 * (Портировано из _check_line_alerts)
 * Проверяет Line Alerts по последней свече.
 */
function _check_line_alerts(
  klinesMap: Map<string, Candle[]>,
  alerts: LineAlert[]
): LineAlert[] {
  const matched_alerts: LineAlert[] = [];
  for (const alert of alerts) {
    const symbol = alert.symbol;
    const alertPrice = alert.price;
    // В TypeScript модели 'price' - это 'number'

    if (!symbol || !klinesMap.has(symbol)) {
      continue;
    }

    const klineList = klinesMap.get(symbol);
    if (!klineList || klineList.length === 0) {
      continue;
    }

    const lastKline = klineList[klineList.length - 1];

    // --- Логика Open/Close ---
    const openPrice = lastKline.openPrice;
    const closePrice = lastKline.closePrice;

    // Проверяем, что klineOpen и klineClose не null/undefined
    if (openPrice == null || closePrice == null) {
      continue;
    }

    // Логика срабатывания (цена между open и close, в любом направлении)
    if (
      (openPrice <= alertPrice && alertPrice <= closePrice) ||
      (closePrice <= alertPrice && alertPrice <= openPrice)
    ) {
      const activationTime = Date.now();
      // Создаем *новый* сработавший алерт
      const matchedAlert: LineAlert = {
        ...alert,
        _id: undefined, // Сбрасываем Mongo ID
        id: uuidv4(), // Генерируем новый UUID
        activationTime: activationTime,
        activationTimeStr: _unix_to_time_str(activationTime),
        highPrice: lastKline.highPrice ?? undefined, // (Это поле ЕСТЬ в LineAlert)
        lowPrice: lastKline.lowPrice ?? undefined, // (Это поле ЕСТЬ в LineAlert)

        // --- 🚀 ИСПРАВЛЕНИЕ (TS2353) ---
        // status: "triggered", // 'status' не существует в модели LineAlert
        // --- 🚀 КОНЕЦ ИСПРАВЛЕНИЯ ---
      };
      matched_alerts.push(matchedAlert);
    }
  }
  return matched_alerts;
}

/**
 * (Портировано из _check_vwap_alerts)
 * Проверяет VWAP Alerts.
 */
function _check_vwap_alerts(
  klinesMap: Map<string, Candle[]>,
  alerts: VwapAlert[]
): VwapAlert[] {
  const triggered_alerts: VwapAlert[] = [];
  for (const vwapAlert of alerts) {
    const symbol = vwapAlert.symbol;
    const anchorTime = vwapAlert.anchorTime;
    // Время "якоря"

    if (!symbol || !anchorTime || !klinesMap.has(symbol)) {
      continue;
    }

    // --- 🚀 ИСПРАВЛЕНИЕ: Нормализация anchorTime к миллисекундам ---
    // (Этот код из вашего файла остается БЕЗ ИЗМЕНЕНИЙ)
    let anchorTimeMs = anchorTime;
    if (anchorTime.toString().length === 10) {
      anchorTimeMs = anchorTime * 1000;
    }
    // --- 🚀 КОНЕЦ ИСПРАВЛЕНИЯ ---

    const klineData = klinesMap.get(symbol);
    if (!klineData || klineData.length === 0) {
      continue;
    }

    const lastKline = klineData[klineData.length - 1];
    const lastKlineOpenTime = lastKline.openTime; // openTime гарантированно в мс

    // Фильтруем свечи от якоря до последней свечи
    const filteredKlines = klineData.filter(
      (kline) =>
        // --- 🚀 ИСПРАВЛЕНИЕ: Используем anchorTimeMs ---
        kline.openTime >= anchorTimeMs && kline.openTime <= lastKlineOpenTime
    );
    if (filteredKlines.length === 0) {
      continue;
    }

    const vwap = _calculate_vwap(filteredKlines);
    if (vwap === 0.0) {
      continue;
    }

    // --- Логика Open/Close ---
    const openPrice = lastKline.openPrice;
    const closePrice = lastKline.closePrice;

    if (openPrice == null || closePrice == null) {
      continue;
    }

    // Логика срабатывания (VWAP внутри свечи, в любом направлении)
    if (
      (openPrice <= vwap && vwap <= closePrice) ||
      (closePrice <= vwap && vwap <= openPrice)
    ) {
      const activationTime = Date.now();
      const triggeredVwap: VwapAlert = {
        ...vwapAlert,
        _id: undefined,
        id: uuidv4(),
        activationTime: activationTime,
        activationTimeStr: _unix_to_time_str(activationTime),

        // --- 🚀 ИСПРАВЛЕНИЕ (Скрытая ошибка) ---
        // (Эти поля НЕ существуют в VwapAlert)
        // highPrice: lastKline.highPrice ?? undefined,
        // lowPrice: lastKline.lowPrice ?? undefined,
        // --- 🚀 КОНЕЦ ИСПРАВЛЕНИЯ ---

        anchorPrice: vwap, // Рассчитанный VWAP
        price: vwap, // Цена срабатывания
      };
      triggered_alerts.push(triggeredVwap);
    }
  }
  return triggered_alerts;
}

/**
 * (Портировано из run_alert_checks)
 * Основная функция, запускающая проверку всех алертов.
 *
 * @param marketData - Объект MarketData, содержащий свежие Klines.
 * @param storage - Экземпляр AlertStorage для доступа к БД.
 */
export async function runAlertChecks(
  marketData: MarketData,
  storage: AlertStorage
): Promise<void> {
  logger.info(
    `[ALERT_CHECKER] Запуск проверки алертов для ${marketData.timeframe}...`,
    DColors.cyan
  );

  // 1. Создаем Klines Map (эквивалент klines_map из Python)
  const klinesMap = new Map<string, Candle[]>();
  for (const coinData of marketData.data) {
    if (coinData.symbol && coinData.candles && coinData.candles.length > 0) {
      // Используем символ из CoinMarketData (e.g., "BTCUSDT")
      klinesMap.set(coinData.symbol, coinData.candles);
    }
  }

  if (klinesMap.size === 0) {
    logger.warn(
      "[ALERT_CHECKER] Данные Klines пусты. Проверка алертов пропущена.",
      DColors.yellow
    );
    return;
  }

  // 2. Проверка Line Alerts
  try {
    // Получаем 'working' и 'isActive' алерты
    const activeLineAlerts = await storage.getLineAlerts("working", true);
    if (activeLineAlerts.length > 0) {
      const matchedLineAlerts = _check_line_alerts(klinesMap, activeLineAlerts);
      if (matchedLineAlerts.length > 0) {
        logger.info(
          `[ALERT_CHECKER] Сработало ${matchedLineAlerts.length} Line Alert(s).`,
          DColors.green
        );
        // Атомарно добавляем в БД
        for (const alert of matchedLineAlerts) {
          await storage.addLineAlert("triggered", alert);
        }
        // Отправляем отчет
        await sendTriggeredLineAlertsReport(matchedLineAlerts);
      } else {
        logger.info(
          "[ALERT_CHECKER] Совпадений по Line Alerts не найдено.",
          DColors.gray
        );
      }
    }
  } catch (e: any) {
    logger.error(
      `[ALERT_CHECKER] Ошибка при проверке Line Alerts: ${e.message}`,
      e
    );
  }

  // 3. Проверка VWAP Alerts
  try {
    // Получаем 'working' и 'isActive' алерты
    const activeVwapAlerts = await storage.getVwapAlerts("working", true);
    if (activeVwapAlerts.length > 0) {
      const matchedVwapAlerts = _check_vwap_alerts(klinesMap, activeVwapAlerts);
      if (matchedVwapAlerts.length > 0) {
        logger.info(
          `[ALERT_CHECKER] Сработало ${matchedVwapAlerts.length} VWAP Alert(s).`,
          DColors.green
        );
        // Атомарно добавляем в БД
        for (const alert of matchedVwapAlerts) {
          await storage.addVwapAlert("triggered", alert);
        }
        // Отправляем отчет
        await sendTriggeredVwapAlertsReport(matchedVwapAlerts);
      } else {
        logger.info(
          "[ALERT_CHECKER] Совпадений по VWAP Alerts не найдено.",
          DColors.gray
        );
      }
    }
  } catch (e: any) {
    logger.error(
      `[ALERT_CHECKER] Ошибка при проверке VWAP Alerts: ${e.message}`,
      e
    );
  }
}
