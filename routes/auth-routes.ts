// routes/auth-routes.ts

/**
 * Этот файл определяет API-маршруты (Hono) для проверки
 * аутентификационных данных (например, email).
 *
 * Ожидает 'alertStorage' в контексте c.var.
 */
import { Hono } from "npm:hono";
import { AlertStorage } from "../alert-manager/alert-storage.ts";
import { logger } from "../utils/logger.ts";

// Определяем тип Hono для 'alertStorage'
type HonoApp = {
  Variables: {
    alertStorage: AlertStorage;
  };
};

export const authRoutes = new Hono<HonoApp>();

/**
 * POST /api/auth/check-email
 * Проверяет, существует ли email в коллекции 'allowed-emails'.
 *
 * @Body { email: string }
 * @Returns { exists: boolean }
 */
authRoutes.post("/auth/check-email", async (c) => {
  const storage = c.var.alertStorage;
  try {
    const body = await c.req.json();
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return c.json(
        {
          exists: false,
          error: "Invalid payload. 'email' (string) is required.",
        },
        400
      );
    }

    // Вызываем новый метод из AlertStorage
    const emailExists = await storage.isEmailAllowed(email);

    return c.json({ exists: emailExists });
  } catch (e: any) {
    logger.error("[API /auth/check-email] " + e.message, e);
    return c.json({ exists: false, error: e.message }, 500);
  }
});
