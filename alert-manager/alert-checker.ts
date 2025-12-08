// deno-lint-ignore-file no-explicit-any
// src/alertManager/alertChecker.ts

import { v4 as uuidv4 } from "npm:uuid";
import { AlertStorage } from "./alert-storage.ts";
import { sendCombinedReport } from "./telegram-sender.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";
import { Candle, MarketData, DColors } from "../models/types.ts";
import { logger } from "../utils/logger.ts";

// --- Вспомогательные функции ---

function _unix_to_time_str(unix_ms: number): string {
  const dt = new Date(unix_ms);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Moscow",
    // 🚀 ИСПРАВЛЕНИЕ: Добавляем дату, чтобы формат совпадал с Telegram
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return new Intl.DateTimeFormat("sv-SE", options).format(dt);
}

function _calculate_vwap(klines: Candle[]): number {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  for (const kline of klines) {
    try {
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

// Хелпер для умного поиска символа
function _get_candles_smart(
  map: Map<string, Candle[]>,
  symbol: string
): Candle[] | undefined {
  if (map.has(symbol)) return map.get(symbol);
  const usdtSymbol = symbol + "USDT";
  if (map.has(usdtSymbol)) return map.get(usdtSymbol);
  return undefined;
}

function _check_line_alerts(
  klinesMap: Map<string, Candle[]>,
  alerts: LineAlert[]
): LineAlert[] {
  const matched_alerts: LineAlert[] = [];
  for (const alert of alerts) {
    const symbol = alert.symbol;
    const alertPrice = alert.price;

    if (!symbol) continue;

    const klineList = _get_candles_smart(klinesMap, symbol);

    if (!klineList || klineList.length === 0) {
      continue;
    }

    const lastKline = klineList[klineList.length - 1];
    const openPrice = lastKline.openPrice;
    const closePrice = lastKline.closePrice;

    if (openPrice == null || closePrice == null) {
      continue;
    }

    if (
      (openPrice <= alertPrice && alertPrice <= closePrice) ||
      (closePrice <= alertPrice && alertPrice <= openPrice)
    ) {
      const activationTime = Date.now();
      const matchedAlert: LineAlert = {
        ...alert,
        _id: undefined,
        id: uuidv4(),
        activationTime: activationTime,
        activationTimeStr: _unix_to_time_str(activationTime),
        highPrice: lastKline.highPrice ?? undefined,
        lowPrice: lastKline.lowPrice ?? undefined,
      };
      matched_alerts.push(matchedAlert);
    }
  }
  return matched_alerts;
}

function _check_vwap_alerts(
  klinesMap: Map<string, Candle[]>,
  alerts: VwapAlert[]
): VwapAlert[] {
  const triggered_alerts: VwapAlert[] = [];
  for (const vwapAlert of alerts) {
    const symbol = vwapAlert.symbol;
    const anchorTime = vwapAlert.anchorTime;

    if (!symbol || !anchorTime) continue;

    const klineData = _get_candles_smart(klinesMap, symbol);

    if (!klineData || klineData.length === 0) {
      continue;
    }

    // Нормализация времени якоря
    let anchorTimeMs = anchorTime;
    if (anchorTime.toString().length === 10) {
      anchorTimeMs = anchorTime * 1000;
    }

    // 🚀 FIX: Проверка целостности истории
    // Самая старая доступная свеча
    const oldestAvailableTime = klineData[0].openTime;

    // Если якорь старее, чем наши данные, мы не можем точно рассчитать VWAP
    if (oldestAvailableTime > anchorTimeMs) {
      // Можно включить лог, если хотите видеть пропущенные
      // logger.warn(`[VWAP Skip] ${symbol}: History too short. Anchor: ${anchorTimeMs}, Oldest: ${oldestAvailableTime}`);
      continue;
    }

    const lastKline = klineData[klineData.length - 1];
    const lastKlineOpenTime = lastKline.openTime;

    // Фильтруем от якоря до сейчас
    const filteredKlines = klineData.filter(
      (kline) =>
        kline.openTime >= anchorTimeMs && kline.openTime <= lastKlineOpenTime
    );

    if (filteredKlines.length === 0) {
      continue;
    }

    const vwap = _calculate_vwap(filteredKlines);
    if (vwap === 0.0) {
      continue;
    }

    const openPrice = lastKline.openPrice;
    const closePrice = lastKline.closePrice;

    if (openPrice == null || closePrice == null) {
      continue;
    }

    // Проверка попадания в тело свечи
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
        anchorPrice: vwap,
        price: vwap,
      };
      triggered_alerts.push(triggeredVwap);
    }
  }
  return triggered_alerts;
}

export async function runAlertChecks(
  marketData: MarketData,
  storage: AlertStorage
): Promise<void> {
  logger.info(
    `[ALERT_CHECKER] Запуск проверки алертов для ${marketData.timeframe}...`,
    DColors.cyan
  );

  const klinesMap = new Map<string, Candle[]>();
  for (const coinData of marketData.data) {
    if (coinData.symbol && coinData.candles && coinData.candles.length > 0) {
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

  let matchedLineAlerts: LineAlert[] = [];
  let matchedVwapAlerts: VwapAlert[] = [];

  // 2. Проверка Line Alerts
  try {
    const activeLineAlerts = await storage.getLineAlerts("working", true);
    if (activeLineAlerts.length > 0) {
      matchedLineAlerts = _check_line_alerts(klinesMap, activeLineAlerts);

      if (matchedLineAlerts.length > 0) {
        logger.info(
          `[ALERT_CHECKER] Сработало ${matchedLineAlerts.length} Line Alert(s).`,
          DColors.green
        );
        for (const alert of matchedLineAlerts) {
          await storage.addLineAlert("triggered", alert);
        }
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
    const activeVwapAlerts = await storage.getVwapAlerts("working", true);
    if (activeVwapAlerts.length > 0) {
      matchedVwapAlerts = _check_vwap_alerts(klinesMap, activeVwapAlerts);

      if (matchedVwapAlerts.length > 0) {
        logger.info(
          `[ALERT_CHECKER] Сработало ${matchedVwapAlerts.length} VWAP Alert(s).`,
          DColors.green
        );
        for (const alert of matchedVwapAlerts) {
          await storage.addVwapAlert("triggered", alert);
        }
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

  try {
    if (matchedLineAlerts.length > 0 || matchedVwapAlerts.length > 0) {
      await sendCombinedReport(matchedLineAlerts, matchedVwapAlerts);
    }
  } catch (e: any) {
    logger.error(
      `[ALERT_CHECKER] Ошибка при отправке СВОДНОГО отчета: ${e.message}`,
      e
    );
  }
}
