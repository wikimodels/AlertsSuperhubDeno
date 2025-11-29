import { Hono } from "npm:hono";
import { logger } from "./utils/logger.ts";
import { DColors } from "./models/types.ts";

// --- API для CRUD монет ---
import { coinRoutes } from "./routes/coin-routes.ts";
import { WorkingCoinStorage } from "./working-coin-manager/working-coin-storage.ts";

// --- 🚀 ИЗМЕНЕНИЕ: API для CRUD алертов ---
import { alertRoutes } from "./routes/alerts-routes.ts";
import { AlertStorage } from "./alert-manager/alert-storage.ts";
// --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

// --- Cron Job (1h) ---
import { runJob } from "./utils/run-job.ts";
import { run1hJob } from "./jobs/job-1h.ts";

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

  // --- Инициализируем и подключаем Mongo 1 РАЗ (Singleton) ---
  const coinStorage = new WorkingCoinStorage();
  // --- 🚀 ИЗМЕНЕНИЕ: Инициализация AlertStorage ---
  const alertStorage = new AlertStorage();
  // --- 🚀 КОНЕЦ ИЗМЕНЕНИЯ ---

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

  Deno.cron("Job 1h Alerts", "0 * * * *", () => {
    // "0 * * * *" = в 00 минут каждого часа
    runJob("1h", run1hJob);
  });

  // Настройка HTTP-сервера (Hono)
  const app = new Hono<HonoApp>();

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

  // Health Check
  app.get("/", (c) => {
    return c.text("Alerts Superhub API is running!");
  });

  // Запуск сервера
  logger.info(
    "[SERVER] HTTP-сервер запущен на http://localhost:8000",
    DColors.green
  );
  Deno.serve(app.fetch);
}

// Запускаем все
startServer();
