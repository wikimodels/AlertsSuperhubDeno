import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import { Coin } from "../../models/types.ts"; // Импортируем интерфейс Coin

const env = await load();

export async function fetchCoins(): Promise<Coin[]> {
  try {
    const url = env["COIN_SIFTER_URL"] + "/coins/formatted-symbols";
    console.log(`[CoinFetcher] Fetching from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": env["SECRET_TOKEN"] || "",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Проверка структуры ответа
    if (!data || !data.symbols || !Array.isArray(data.symbols)) {
      console.error("[CoinFetcher] Invalid data format:", data);
      throw new Error("Invalid response format from Coin Sifter");
    }

    const rawCoins = data.symbols;
    console.log(`[CoinFetcher] Received ${rawCoins.length} raw items.`);

    // Маппинг и валидация
    const coins: Coin[] = rawCoins
      .map((item: Coin) => {
        // Если API возвращает просто строки ['BTCUSDT', ...]
        if (typeof item === "string") {
          return {
            symbol: item,
            exchanges: ["BYBIT"], // Дефолт, если нет инфо
            category: 0,
          };
        }
        // Если API возвращает объекты
        return {
          symbol: item.symbol,
          exchanges: Array.isArray(item.exchanges) ? item.exchanges : ["BYBIT"],
          category: typeof item.category === "number" ? item.category : 0,
        };
      })
      .filter((c: Coin) => c && c.symbol); // Убираем пустые

    console.log(`[CoinFetcher] Parsed ${coins.length} valid coins.`);
    return coins;
  } catch (error) {
    console.error("Failed to fetch or parse coins data:", error);
    throw error;
  }
}
