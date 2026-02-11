import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "./utils/logger.ts";
import { DColors } from "./models/types.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables from .env file
await load({ export: true });

// --- API для CRUD монет ---
import { coinRoutes } from "./routes/coin-routes.ts";
import { WorkingCoinStorage } from "./working-coin-manager/working-coin-storage.ts";

// --- 🚀 ИЗМЕНЕНИЕ: API для CRUD алертов ---
import { alertRoutes } from "./routes/alerts-routes.ts";
import { AlertStorage } from "./alert-manager/alert-storage.ts";

// --- 🚀 ИЗМЕНЕНИЕ №3: API для Auth ---
import { authRoutes } from "./routes/auth-routes.ts";
// --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

// --- Cron Job (1h) ---
import { runJob } from "./utils/run-job.ts";
import { run1hJob } from "./jobs/job-1h.ts";
import { runCleanupJob } from "./jobs/job-cleanup.ts";

// --- 🚀 ИЗМЕНЕНИЕ: Типизация Hono для ДВУХ storage ---
type HonoApp = {
  Variables: {
    storage: WorkingCoinStorage;
    alertStorage: AlertStorage; // <-- Добавлено
  };
};
// --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

/**
 * 1. Запускает CRON job (1h)
 * 2. Запускает HTTP-сервер (Hono) для CRUD API
 */
async function startServer() {
  logger.info("=======================================", DColors.cyan);
  logger.info("🚀 ЗАПУСК СЕРВЕРА ALERTS-SUPERHUB", DColors.cyan);
  logger.info("=======================================", DColors.cyan);


  // Debug: Load allowed origins from .env
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(",") : [];

  logger.info(`[CONFIG] ALLOWED_ORIGINS source: ENV`, allowedOriginsEnv ? DColors.green : DColors.yellow);
  logger.info(`[CONFIG] Active Origins: ${allowedOrigins.join(", ")}`, DColors.cyan);

  if (allowedOrigins.length === 0) {
    logger.warn("[CONFIG] WARNING: No allowed origins configured! CORS might block requests.", DColors.yellow);
  }

  // --- Инициализируем и подключаем Mongo 1 РАЗ (Singleton) ---
  const coinStorage = new WorkingCoinStorage();
  // --- 🚀 ИЗМЕНЕНИЕ: Инициализация AlertStorage ---
  const alertStorage = new AlertStorage();

  try {
    await coinStorage.connect();
    logger.info(
      "[SERVER] WorkingCoinStorage (Singleton) подключен.",
      DColors.green
    );
    // --- 🚀 ИЗМЕНЕНИЕ: Подключение AlertStorage ---
    await alertStorage.connect();
    logger.info("[SERVER] AlertStorage (Singleton) подключен.", DColors.green);
    // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---
  } catch (e) {
    logger.error(
      "[SERVER] КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к MongoDB.",
      e
    );
    Deno.exit(1);
  }
  // --- КОНЕЦ ---

  // Настройка CRON Jobs
  logger.info("[CRON] Настройка Cron Job 1h (Alerts)...", DColors.cyan);
  Deno.cron("Job 1h Alerts", "3 * * * *", () => {
    // "0 * * * *" = в 00 минут каждого часа
    runJob("1h", run1hJob);
  });

  Deno.cron("Job Cleanup Old Alerts", "0 0 * * *", async () => {
    await runCleanupJob();
  });

  // Настройка HTTP-сервера (Hono)
  const app = new Hono<HonoApp>();

  // --- 🚀 CORS Middleware (Global) ---
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Проверяем, разрешен ли origin
        if (allowedOrigins.includes(origin)) {
          return origin;
        }

        // По умолчанию - первый разрешенный origin
        return allowedOrigins[0];
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length", "X-Request-Id"],
      maxAge: 600, // Preflight кэш на 10 минут
      credentials: true, // Разрешаем отправку cookies/auth headers
    })
  );
  logger.info("[SERVER] CORS middleware настроен.", DColors.green);
  // --- 🚀 КОНЕЦ CORS ---

  // --- Middleware: Внедряем ОБА storage в контекст (singleton) ---
  app.use("/api/*", async (c, next) => {
    c.set("storage", coinStorage);
    // --- 🚀 ИЗМЕНЕНИЕ: Внедряем alertStorage ---
    c.set("alertStorage", alertStorage);
    // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---
    await next();
  });
  // --- КОНЕЦ ---

  // Подключаем CRUD-роуты
  app.route("/api", coinRoutes);
  // --- 🚀 ИЗМЕНЕНИЕ: Подключаем alertRoutes ---
  app.route("/api", alertRoutes);
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

  // --- 🚀 ИЗМЕНЕНИЕ №3: Подключаем authRoutes ---
  app.route("/api", authRoutes);
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

  // Health Check
  app.get("/", (c) => {
    return c.json({
      status: "ok",
      message: "Alerts Superhub API is running!",
      timestamp: new Date().toISOString(),
      cors: "enabled",
    });
  });

  // Запуск сервера
  const PORT = Deno.env.get("PORT") || "8000";
  logger.info(
    `[SERVER] HTTP-сервер запущен на порту ${PORT}...`,
    DColors.green
  );
  Deno.serve({ port: parseInt(PORT) }, app.fetch);
}

// Запускаем все
startServer();
