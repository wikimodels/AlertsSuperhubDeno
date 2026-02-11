// deno-lint-ignore-file no-explicit-any
// src/fetchers/kline-fetchers.ts

import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { TF, DColors, MarketData } from "../../models/types.ts";
import { logger } from "../../utils/logger.ts";

const env = await load();
const BASE_URL = env["BAZZAR_KLINE_FETCHER_URL"];
const TOKEN = env["SECRET_TOKEN"];

/**
 * Интерфейс ответа от Render API
 * Поле data полностью соответствует нашему интерфейсу MarketData
 */
interface KlineApiResponse {
  success: boolean;
  data: MarketData;
  error?: string;
}

/**
 * Универсальный fetcher для Klines
 * Возвращает готовый MarketData (snapshot) с сервера или null в случае ошибки.
 */
export async function fetchKlineData(
  timeframe: TF
): Promise<MarketData | null> {
  // 1. Быстрая проверка
  if (timeframe !== "1h") {
    logger.error(
      `[Kline Fetcher] Only '1h' timeframe is supported. Got: ${timeframe}`,
      DColors.red
    );
    return null;
  }

  // Запрос без параметров (сервер отдает дефолтный лимит для 1h)
  const url = `${BASE_URL}/api/cache/${timeframe}`;

  logger.info(
    `[Kline Fetcher] Connecting to Render Service... [${timeframe}]`,
    DColors.cyan
  );

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (TOKEN) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  } else {
    logger.warn("[Kline Fetcher] SECRET_TOKEN missing in .env", DColors.yellow);
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const json: KlineApiResponse = await response.json();

    if (!json.success || !json.data || !Array.isArray(json.data.data)) {
      throw new Error("Invalid response format from Render API");
    }

    const marketData = json.data;

    logger.success(
      `[Kline Fetcher] ✓ Success: Loaded snapshot. Coins: ${
        marketData.coinsNumber
      }, UpdatedAt: ${new Date(marketData.updatedAt).toISOString()}`,
      DColors.green
    );

    return marketData;
  } catch (error: any) {
    logger.error(`[Kline Fetcher] ✗ Critical Error: ${error.message}`, error);
    return null;
  }
}
