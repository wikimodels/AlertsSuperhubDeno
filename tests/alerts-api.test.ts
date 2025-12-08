import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.223.0/assert/mod.ts";
import { LineAlert, VwapAlert } from "../models/alerts.ts";

const BASE_URL = "http://localhost:8000/api";
let testAlertId1 = ""; // Будет установлен в Шаге 1

// --- 🚀 ХЕЛПЕРЫ ДЛЯ ОЧИСТКИ ---

/**
 * Очищает ВСЕ 'working' Line алерты
 */
async function cleanupAllLineAlerts(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/alerts/line/all`, { method: "DELETE" });
  if (!res.ok) {
    console.error("🧹 [Cleanup Line] Ошибка! Сервер вернул", res.status);
    return false;
  }
  const data = await res.json();
  console.log(
    `🧹 [Cleanup Line] Успешно удалено ${data.deletedCount} line alert(s).`
  );
  return data.deletedCount !== undefined;
}

/**
 * Очищает ВСЕ 'working' VWAP алерты
 */
async function cleanupAllVwapAlerts(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/alerts/vwap/all`, { method: "DELETE" });
  if (!res.ok) {
    console.error("🧹 [Cleanup VWAP] Ошибка! Сервер вернул", res.status);
    return false;
  }
  const data = await res.json();
  console.log(
    `🧹 [Cleanup VWAP] Успешно удалено ${data.deletedCount} vwap alert(s).`
  );
  return data.deletedCount !== undefined;
}

// --- 🚀 ТЕСТОВЫЕ ДАННЫЕ ---

// (API сам сгенерирует 'id' и 'isActive')
const TEST_LINE_ALERT_1: Partial<LineAlert> = {
  symbol: "BTCUSDT",
  price: 10000,
  category: 1,
};

const TEST_LINE_ALERT_2: Partial<LineAlert> = {
  symbol: "ETHUSDT",
  price: 500,
  category: 1,
};

const TEST_VWAP_ALERT_1: Partial<VwapAlert> = {
  symbol: "SOLUSDT",
  anchorTime: 1700000000000,
  category: 2,
};

// --- 🚀 СЦЕНАРИЙ 1: LINE ALERT API ---

Deno.test("E2E - Line Alert API Lifecycle", async (t) => {
  // --- Setup ---
  await t.step("[Setup] Очистка Line Alerts", async () => {
    const success = await cleanupAllLineAlerts();
    assert(success, "Очистка Line Alerts провалилась!");
  });

  // --- Tests ---
  try {
    await t.step("1. Add one line alert (POST /alerts/line)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line`, {
        method: "POST",
        body: JSON.stringify(TEST_LINE_ALERT_1),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.success, true);
      assert(data.id, "Сервер должен был вернуть ID");
      testAlertId1 = data.id; // Сохраняем ID для Шага 6
    });

    await t.step("2. Get all (should be 1 line alert)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.count, 1);
      assertEquals(data.data[0].symbol, "BTCUSDT");
      // ✅ УБРАЛИ ПРОВЕРКУ STATUS
    });

    await t.step("3. Add batch (POST /alerts/line/batch)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line/batch`, {
        method: "POST",
        body: JSON.stringify([
          TEST_LINE_ALERT_2,
          { ...TEST_LINE_ALERT_1, symbol: "XRPUSDT", price: 1 },
        ]),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.count, 2);
    });

    await t.step("4. Get all (should be 3 line alerts)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.count, 3);
    });

    await t.step("5. Check uniqueness (POST /alerts/line)", async () => {
      // Пытаемся добавить алерт с ID, который уже существует
      const res = await fetch(`${BASE_URL}/alerts/line`, {
        method: "POST",
        body: JSON.stringify({ ...TEST_LINE_ALERT_1, id: testAlertId1 }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.success, false); // Должен вернуть 'false' (дубликат)
    });

    await t.step("6. Delete one (DELETE /alerts/line/:id)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line/${testAlertId1}`, {
        method: "DELETE",
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.success, true);
    });

    await t.step("7. Get all (should be 2 line alerts)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.count, 2);
    });

    await t.step(
      "8. Delete batch (POST /alerts/line/delete-batch)",
      async () => {
        // Получаем ID оставшихся 2 алертов
        const resGet = await fetch(`${BASE_URL}/alerts/line`);
        const dataGet = await resGet.json();
        const idsToDelete = dataGet.data.map((a: LineAlert) => a.id);

        const resDel = await fetch(`${BASE_URL}/alerts/line/delete-batch`, {
          method: "POST",
          body: JSON.stringify(idsToDelete),
          headers: { "Content-Type": "application/json" },
        });
        const dataDel = await resDel.json();
        assertEquals(resDel.status, 200);
        assertEquals(dataDel.deletedCount, 2);
      }
    );

    await t.step("9. Get all (should be 0 line alerts)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/line`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.count, 0);
    });
  } finally {
    // --- Teardown ---
    await t.step("[Teardown] Очистка Line Alerts", async () => {
      await cleanupAllLineAlerts();
    });
  }
});

// --- 🚀 СЦЕНАРИЙ 2: VWAP ALERT API ---

Deno.test("E2E - Vwap Alert API Lifecycle", async (t) => {
  // --- Setup ---
  await t.step("[Setup] Очистка VWAP Alerts", async () => {
    const success = await cleanupAllVwapAlerts();
    assert(success, "Очистка Vwap Alerts провалилась!");
  });

  try {
    await t.step("1. Add one vwap alert (POST /alerts/vwap)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/vwap`, {
        method: "POST",
        body: JSON.stringify(TEST_VWAP_ALERT_1),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.success, true);
      assert(data.id, "Сервер должен был вернуть ID");
    });

    await t.step("2. Get all (should be 1 vwap alert)", async () => {
      const res = await fetch(`${BASE_URL}/alerts/vwap`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.count, 1);
      assertEquals(data.data[0].symbol, "SOLUSDT");
    });
  } finally {
    // --- Teardown ---
    await t.step("[Teardown] Очистка VWAP Alerts", async () => {
      await cleanupAllVwapAlerts();
    });
  }
});
