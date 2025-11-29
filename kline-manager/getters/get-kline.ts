// deno-lint-ignore-file no-explicit-any
// src/fetchers/kline-fetchers.ts
// (УПРОЩЕННАЯ ВЕРСИЯ - ТОЛЬКО 1h)

import {
  TF,
  DColors,
  Coin,
  FetcherResult,
  CoinMarketData,
  FailedCoinResult,
} from "../../models/types.ts";
import { logger } from "../../utils/logger.ts";
import { binancePerpsUrl } from "../../utils/urls/binance/binance-perps-url.ts";
import { bybitPerpUrl } from "../../utils/urls/bybit/bybit-perps-url.ts";

// --- 🚀 ИЗМЕНЕНИЕ: Оставляем только 1h ---
const BYBIT_INTERVALS: Record<TF, string> = {
  "1h": "60",
  "4h": "60", // Фоллбэк на 1h, если TF другой
  "8h": "60",
  "12h": "60",
  D: "60",
};
const BINANCE_INTERVALS: Record<TF, string> = {
  "1h": "1h",
  "4h": "1h", // Фоллбэк на 1h
  "8h": "1h",
  "12h": "1h",
  D: "1h",
};
// --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
];
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 🚀 ИЗМЕНЕНИЕ: Функции Resampling удалены (не нужны для 1h) ---
// function isAlignedToTimeframe(...)
// function findFirstAlignedIndex(...)
// function resampleKlines(...)
// --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

async function fetchBinanceKlineData(
  symbol: string,
  timeframe: TF,
  limit: number,
  delayMs: number
): Promise<any> {
  if (delayMs > 0) await delay(delayMs);
  const interval = BINANCE_INTERVALS[timeframe]; // Возьмет '1h'
  const url = binancePerpsUrl(symbol, interval, limit);
  const randomUserAgent =
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const response = await fetch(url, {
    headers: {
      "User-Agent": randomUserAgent,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.binance.com",
      Origin: "https://www.binance.com",
    },
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);

  const rawData = await response.json();
  if (!Array.isArray(rawData))
    throw new Error(`Invalid Binance response for ${symbol}`);
  const klines = rawData.sort(
    (a: any, b: any) => parseInt(a[0]) - parseInt(b[0])
  );
  let processedData = klines.map((entry: any) => {
    const totalQuoteVolume = parseFloat(entry[7]);
    const takerBuyQuote = parseFloat(entry[10]);
    const sellerQuoteVolume = totalQuoteVolume - takerBuyQuote;
    const volumeDelta = takerBuyQuote - sellerQuoteVolume;

    return {
      openTime: parseInt(entry[0]),
      openPrice: parseFloat(entry[1]),
      highPrice: parseFloat(entry[2]),
      lowPrice: parseFloat(entry[3]),
      closePrice: parseFloat(entry[4]),
      volume: totalQuoteVolume,
      volumeDelta: parseFloat(volumeDelta.toFixed(2)),
      closeTime: parseInt(entry[6]),
    };
  });
  if (processedData.length > 2) {
    processedData = processedData.slice(0, -1);
  }

  return processedData;
}

async function fetchBybitKlineData(
  symbol: string,
  timeframe: TF,
  limit: number,
  delayMs: number
): Promise<any> {
  if (delayMs > 0) await delay(delayMs);
  const bybitInterval = BYBIT_INTERVALS[timeframe]; // Возьмет '60'

  // --- 🚀 ИЗМЕНЕНИЕ: Убран расчет fetchLimit, используется limit ---
  const url = bybitPerpUrl(symbol, bybitInterval, limit);
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

  const randomUserAgent =
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const response = await fetch(url, {
    headers: {
      "User-Agent": randomUserAgent,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.bybit.com",
      Origin: "https://www.bybit.com",
    },
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const rawData = await response.json();
  if (!rawData?.result?.list)
    throw new Error(`Invalid Bybit response for ${symbol}`);

  let klines = rawData.result.list;
  if (klines.length === 0) throw new Error(`No data for ${symbol}`);
  klines = [...klines].sort(
    (a: any, b: any) => parseInt(a[0]) - parseInt(b[0])
  );

  // --- 🚀 ИЗМЕНЕНИЕ: Удалены вызовы resampleKlines ---
  // if (timeframe === TF.h8) ...
  // else if (timeframe === TF.D) ...
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

  if (klines.length === 0) throw new Error(`No aligned candles for ${symbol}`);
  let processedData = klines.map((entry: any) => ({
    openTime: parseInt(entry[0]),
    openPrice: parseFloat(entry[1]),
    highPrice: parseFloat(entry[2]),
    lowPrice: parseFloat(entry[3]),
    closePrice: parseFloat(entry[4]),
    volume: parseFloat(entry[7]),
    volumeDelta: 0,
    closeTime: parseInt(entry[6]),
  }));
  if (processedData.length > 2) {
    processedData = processedData.slice(0, -1);
  }

  return processedData;
}

async function fetchKlineData(
  symbol: string,
  exchange: "binance" | "bybit",
  timeframe: TF,
  limit: number,
  delayMs: number
): Promise<any> {
  try {
    let data: any[] = [];
    if (exchange === "binance") {
      data = await fetchBinanceKlineData(symbol, timeframe, limit, delayMs);
    } else {
      data = await fetchBybitKlineData(symbol, timeframe, limit, delayMs);
    }
    return {
      success: true,
      symbol,
      data,
    };
  } catch (error: any) {
    logger.error(
      `${symbol} [${exchange}] error: ${error.message}`,
      DColors.red
    );
    return {
      success: false,
      symbol,
      error: error.message.replace(/[<>'"]/g, ""),
    };
  }
}

async function fetchInBatches<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    logger.info(
      `Progress: ${Math.min(i + batchSize, items.length)}/${items.length}`,
      DColors.cyan
    );
  }

  return results;
}

export async function fetchKlines(
  coins: Coin[],
  exchange: "binance" | "bybit",
  timeframe: TF,
  limit: number,
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<FetcherResult> {
  // --- 🚀 ИЗМЕНЕНИЕ: Строгая проверка на 1h ---
  if (timeframe !== "1h") {
    logger.error(
      `[fetchKlines] Этот модуль настроен только для '1h'. Получен: ${timeframe}`,
      DColors.red
    );
    return { successful: [], failed: [] };
  }
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

  const batchSize = options?.batchSize || coins.length;
  const delayMs = options?.delayMs || 0;

  logger.info(
    `Fetching ${exchange.toUpperCase()} Klines for ${
      coins.length
    } coins [${timeframe}] | Batch: ${batchSize} | Delay: ${delayMs}ms`,
    DColors.cyan
  );
  const results = await fetchInBatches(coins, batchSize, (coin) =>
    fetchKlineData(coin.symbol, exchange, timeframe, limit, delayMs)
  );
  const successfulRaw = results.filter((r) => r.success);
  const failedRaw = results.filter((r) => !r.success);

  const successful: CoinMarketData[] = successfulRaw.map((item) => {
    // <- ИСПРАВЛЕНО
    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Находим оригинальную монету, чтобы получить ее массив exchanges
    const originalCoin = coins.find((c) => c.symbol === item.symbol);

    return {
      symbol: item.symbol,
      exchanges: originalCoin?.exchanges || [], // Используем 'exchanges' из originalCoin
      candles: item.data.map((d: any) => ({
        openTime: d.openTime,
        openPrice: d.openPrice, // Добавлено в предыдущем шаге
        highPrice: d.highPrice,
        lowPrice: d.lowPrice,
        closePrice: d.closePrice,
        volume: d.volume,
        volumeDelta: d.volumeDelta,
      })),
    };
  });
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

  const failed: FailedCoinResult[] = failedRaw.map((item) => ({
    symbol: item.symbol,
    error: item.error,
  }));
  logger.info(
    `✓ Success: ${successful.length} | ✗ Failed: ${failed.length}`,
    successful.length > 0 ? DColors.green : DColors.yellow
  );
  return { successful, failed };
}
