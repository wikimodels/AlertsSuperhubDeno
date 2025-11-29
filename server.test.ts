// deno-lint-ignore-file no-explicit-any
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.223.0/assert/mod.ts";
import { WorkingCoin } from "./models/working-coin.ts";

const BASE_URL = "http://localhost:8000/api";

// --- 🚀 ИЗМЕНЕНИЕ: Улучшенный Хелпер Очистки ---
/**
 * Очищает ВСЕ монеты из БД и проверяет ответ
 */
async function cleanupAllCoins(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/coins/all`, { method: "DELETE" });

    // 🚀 ПРОВЕРКА 1: Был ли запрос успешным?
    if (!res.ok) {
      console.error(
        `🧹 [Cleanup] Ошибка! Сервер вернул ${res.status} ${res.statusText}`
      );
      try {
        const errBody = await res.json();
        console.error("🧹 [Cleanup] Тело ошибки:", errBody);
      } catch {
        // (Игнорируем, если тело не JSON)
      }
      return false;
    }

    const data = await res.json();

    // 🚀 ПРОВЕРКА 2: Правильный ли JSON?
    if (data.deletedCount === undefined) {
      console.error(
        `🧹 [Cleanup] Ошибка! Ответ не содержит 'deletedCount'. Получено:`,
        data
      );
      return false;
    }

    console.log(`🧹 [Cleanup] Успешно удалено ${data.deletedCount} монет.`);
    return true;
  } catch (e: any) {
    console.error(`🧹 [Cleanup] КРИТИЧЕСКАЯ Ошибка fetch: ${e.message}`);
    return false;
  }
}

// --- Тестовые монеты (без изменений) ---
const COIN_BTC: WorkingCoin = {
  symbol: "BTCUSDT",
  exchanges: ["BINANCE", "BYBIT"],
  category: 1,
};
const COIN_ETH: WorkingCoin = {
  symbol: "ETHUSDT",
  exchanges: ["BINANCE"],
  category: 1,
};
const COIN_SOL: WorkingCoin = {
  symbol: "SOLUSDT",
  exchanges: ["BYBIT"],
  category: 1,
};

// --- Главный Тестовый Сценарий ---

Deno.test("E2E - Coin API Lifecycle", async (t) => {
  // --- 🚀 ИЗМЕНЕНИЕ: Шаг "BeforeAll" для очистки ---
  await t.step("[Setup] Очистка БД перед тестом", async () => {
    const success = await cleanupAllCoins();
    assert(success, "Очистка перед тестом провалилась! Тест остановлен.");
  });

  // --- Основные тесты (без изменений) ---
  await t.step("1. Add one coin (POST /coins)", async () => {
    const res = await fetch(`${BASE_URL}/coins`, {
      method: "POST",
      body: JSON.stringify(COIN_BTC),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, true);
  });

  await t.step("2. Get all (should be 1 coin)", async () => {
    const res = await fetch(`${BASE_URL}/coins`);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.count, 1);
    assertEquals(data.data[0].symbol, "BTCUSDT");
  });

  await t.step("3. Add batch (POST /coins/batch)", async () => {
    const res = await fetch(`${BASE_URL}/coins/batch`, {
      method: "POST",
      body: JSON.stringify([COIN_ETH, COIN_SOL]),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, true);
  });

  await t.step("4. Get all (should be 3 coins)", async () => {
    const res = await fetch(`${BASE_URL}/coins`);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.count, 3);
  });

  await t.step("5. Delete one (DELETE /coins/:symbol)", async () => {
    const res = await fetch(`${BASE_URL}/coins/${COIN_BTC.symbol}`, {
      method: "DELETE",
    });
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, true);
  });

  await t.step("6. Get all (should be 2 coins)", async () => {
    const res = await fetch(`${BASE_URL}/coins`);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.count, 2);
    const symbols = data.data.map((c: WorkingCoin) => c.symbol);
    assert(!symbols.includes(COIN_BTC.symbol));
  });

  await t.step("7. Check uniqueness (POST /coins)", async () => {
    const res = await fetch(`${BASE_URL}/coins`, {
      method: "POST",
      body: JSON.stringify(COIN_ETH),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.success, false);
  });

  await t.step("8. Delete batch (POST /coins/delete-batch)", async () => {
    const res = await fetch(`${BASE_URL}/coins/delete-batch`, {
      method: "POST",
      body: JSON.stringify([COIN_ETH.symbol, COIN_SOL.symbol]),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.deletedCount, 2);
  });

  await t.step("9. Get all (should be 0 coins)", async () => {
    const res = await fetch(`${BASE_URL}/coins`);
    const data = await res.json();
    assertEquals(res.status, 200);
    assertEquals(data.count, 0);
  });

  // --- 🚀 ИЗМЕНЕНИЕ: Шаг "AfterAll" для очистки ---
  await t.step("[Teardown] Очистка БД после теста", async () => {
    await cleanupAllCoins();
  });
});
