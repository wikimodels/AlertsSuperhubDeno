// auth-api.test.ts

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.223.0/assert/mod.ts";

// Базовый URL вашего API (по аналогии с alerts-api.test.ts)
const BASE_URL = "http://localhost:8000/api";

Deno.test("E2E - Auth API - Check Email", async (t) => {
  const endpoint = `${BASE_URL}/auth/check-email`;

  await t.step(
    "1. Should return {exists: true} for an allowed email",
    async () => {
      // Этот email взят из вашего скриншота
      const payload = {
        email: "young.wiki.models@gmail.com",
      };

      const res = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      assertEquals(res.status, 200);
      assertEquals(
        data.exists,
        true,
        "Email 'young.wiki.models@gmail.com' должен существовать"
      );
    }
  );

  await t.step(
    "2. Should return {exists: false} for a non-existent email",
    async () => {
      const payload = {
        email: "test@nonexistent-domain-12345.com",
      };

      const res = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      assertEquals(res.status, 200);
      assertEquals(
        data.exists,
        false,
        "Случайный email не должен существовать"
      );
    }
  );

  await t.step(
    "3. Should return 400 Bad Request for invalid payload",
    async () => {
      // Отправляем некорректное тело (не тот ключ)
      const payload = {
        user: "test@example.com",
      };

      const res = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      assertEquals(res.status, 400);
      assertEquals(data.exists, false);
      assert(
        data.error.includes("'email' (string) is required"),
        "Должно быть сообщение об ошибке 'email is required'"
      );
    }
  );

  await t.step("4. Should return 400 Bad Request for empty body", async () => {
    // Отправляем пустое тело
    const payload = {};

    const res = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();

    assertEquals(res.status, 400);
    assertEquals(data.exists, false);
    assert(data.error.includes("'email' (string) is required"));
  });
});
