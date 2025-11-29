// alert-trigger.test.ts
import { assertEquals } from "https://deno.land/std@0.223.0/assert/mod.ts";
import { AlertStorage } from "./alert-manager/alert-storage.ts";
import { runAlertChecks } from "./alert-manager/alert-checker.ts";
import { LineAlert, VwapAlert } from "./models/alerts.ts";
import { MarketData, CoinMarketData, Candle } from "./models/types.ts";
import { v4 as uuidv4 } from "npm:uuid";

// ==================== HELPERS ====================

function createCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  openTime: number
): Candle {
  return {
    openTime: openTime,
    openPrice: open,
    highPrice: high,
    lowPrice: low,
    closePrice: close,
    volume: 1000,
    closeTime: openTime + 3600_000 - 1,
  };
}

function createMarketData(symbol: string, candles: Candle[]): MarketData {
  const coinData: CoinMarketData = {
    symbol: symbol,
    exchanges: ["BINANCE"],
    candles: candles,
  };

  return {
    timeframe: "1h",
    openTime: candles[0]?.openTime || Date.now(),
    updatedAt: Date.now(),
    coinsNumber: 1,
    data: [coinData],
  };
}

// ==================== LINE ALERT TESTS ====================

Deno.test("Line Alert - Should trigger when price crosses UP", async () => {
  const storage = new AlertStorage();
  await storage.connect();

  try {
    // Cleanup
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();

    // Add alert at $100
    const alert: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Test",
      action: "BUY",
      price: 100.0,
      exchanges: ["BINANCE"],
      isActive: true,
      category: 1,
    };
    await storage.addWorkingLineAlert(alert);

    // Create candle that crosses UP: 90 -> 110
    const candle = createCandle(90, 110, 85, 105, Date.now());
    const marketData = createMarketData("BTCUSDT", [candle]);

    // Run checker
    await runAlertChecks(marketData, storage);

    // Assert: should trigger
    const triggered = await storage.getTriggeredLineAlerts();
    assertEquals(triggered.length, 1);
    assertEquals(triggered[0].symbol, "BTCUSDT");
    assertEquals(triggered[0].price, 100.0);
  } finally {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();
    await storage.disconnect();
  }
});

Deno.test("Line Alert - Should trigger when price crosses DOWN", async () => {
  const storage = new AlertStorage();
  await storage.connect();

  try {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();

    // Add alert at $100
    const alert: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Test",
      action: "SELL",
      price: 100.0,
      exchanges: ["BINANCE"],
      isActive: true,
      category: 1,
    };
    await storage.addWorkingLineAlert(alert);

    // Create candle that crosses DOWN: 110 -> 90
    const candle = createCandle(110, 115, 85, 90, Date.now());
    const marketData = createMarketData("BTCUSDT", [candle]);

    // Run checker
    await runAlertChecks(marketData, storage);

    // Assert: should trigger
    const triggered = await storage.getTriggeredLineAlerts();
    assertEquals(triggered.length, 1);
    assertEquals(triggered[0].symbol, "BTCUSDT");
  } finally {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();
    await storage.disconnect();
  }
});

Deno.test(
  "Line Alert - Should NOT trigger when price doesn't cross",
  async () => {
    const storage = new AlertStorage();
    await storage.connect();

    try {
      await storage.removeAllWorkingLineAlerts();
      await storage.removeAllTriggeredLineAlerts();

      // Add alert at $100
      const alert: LineAlert = {
        id: uuidv4(),
        symbol: "BTCUSDT",
        alertName: "Test",
        action: "BUY",
        price: 100.0,
        exchanges: ["BINANCE"],
        isActive: true,
        category: 1,
      };
      await storage.addWorkingLineAlert(alert);

      // Create candle that DOESN'T cross: 60 -> 80 (both below 100)
      const candle = createCandle(60, 80, 55, 75, Date.now());
      const marketData = createMarketData("BTCUSDT", [candle]);

      // Run checker
      await runAlertChecks(marketData, storage);

      // Assert: should NOT trigger
      const triggered = await storage.getTriggeredLineAlerts();
      assertEquals(triggered.length, 0);
    } finally {
      await storage.removeAllWorkingLineAlerts();
      await storage.removeAllTriggeredLineAlerts();
      await storage.disconnect();
    }
  }
);

Deno.test("Line Alert - Should NOT trigger when isActive = false", async () => {
  const storage = new AlertStorage();
  await storage.connect();

  try {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();

    // Add INACTIVE alert
    const alert: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Test",
      action: "BUY",
      price: 100.0,
      exchanges: ["BINANCE"],
      isActive: false, // ← INACTIVE
      category: 1,
    };
    await storage.addWorkingLineAlert(alert);

    // Create candle that crosses
    const candle = createCandle(90, 110, 85, 105, Date.now());
    const marketData = createMarketData("BTCUSDT", [candle]);

    // Run checker
    await runAlertChecks(marketData, storage);

    // Assert: should NOT trigger (alert is inactive)
    const triggered = await storage.getTriggeredLineAlerts();
    assertEquals(triggered.length, 0);
  } finally {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();
    await storage.disconnect();
  }
});

// ==================== VWAP ALERT TESTS ====================

Deno.test("VWAP Alert - Should trigger when price crosses VWAP", async () => {
  const storage = new AlertStorage();
  await storage.connect();

  try {
    await storage.removeAllWorkingVwapAlerts();
    await storage.removeAllTriggeredVwapAlerts();

    const anchorTime = Date.now() - 3600_000 * 3; // 3 hours ago

    // Add VWAP alert
    const alert: VwapAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "VWAP Test",
      action: "BUY",
      price: 0, // Will be calculated
      exchanges: ["BINANCE"],
      isActive: true,
      category: 2,
      anchorTime: anchorTime,
    };
    await storage.addWorkingVwapAlert(alert);

    // Create 3 candles that will produce VWAP ≈ 100
    const candles = [
      createCandle(95, 105, 90, 100, anchorTime),
      createCandle(98, 108, 93, 103, anchorTime + 3600_000),
      createCandle(97, 107, 92, 102, anchorTime + 3600_000 * 2),
    ];

    // Last candle crosses VWAP
    const lastCandle = createCandle(
      90,
      110,
      85,
      105,
      anchorTime + 3600_000 * 3
    );
    candles.push(lastCandle);

    const marketData = createMarketData("BTCUSDT", candles);

    // Run checker
    await runAlertChecks(marketData, storage);

    // Assert: should trigger
    const triggered = await storage.getTriggeredVwapAlerts();
    assertEquals(triggered.length, 1);
    assertEquals(triggered[0].symbol, "BTCUSDT");
  } finally {
    await storage.removeAllWorkingVwapAlerts();
    await storage.removeAllTriggeredVwapAlerts();
    await storage.disconnect();
  }
});

Deno.test(
  "VWAP Alert - Should NOT trigger when price doesn't cross VWAP",
  async () => {
    const storage = new AlertStorage();
    await storage.connect();

    try {
      await storage.removeAllWorkingVwapAlerts();
      await storage.removeAllTriggeredVwapAlerts();

      const anchorTime = Date.now() - 3600_000 * 3;

      const alert: VwapAlert = {
        id: uuidv4(),
        symbol: "BTCUSDT",
        alertName: "VWAP Test",
        action: "BUY",
        price: 0,
        exchanges: ["BINANCE"],
        isActive: true,
        category: 2,
        anchorTime: anchorTime,
      };
      await storage.addWorkingVwapAlert(alert);

      // Create candles with VWAP ≈ 100
      const candles = [
        createCandle(95, 105, 90, 100, anchorTime),
        createCandle(98, 108, 93, 103, anchorTime + 3600_000),
        createCandle(97, 107, 92, 102, anchorTime + 3600_000 * 2),
      ];

      // Last candle DOESN'T cross VWAP (stays below)
      const lastCandle = createCandle(
        60,
        80,
        55,
        75,
        anchorTime + 3600_000 * 3
      );
      candles.push(lastCandle);

      const marketData = createMarketData("BTCUSDT", candles);

      // Run checker
      await runAlertChecks(marketData, storage);

      // Assert: should NOT trigger
      const triggered = await storage.getTriggeredVwapAlerts();
      assertEquals(triggered.length, 0);
    } finally {
      await storage.removeAllWorkingVwapAlerts();
      await storage.removeAllTriggeredVwapAlerts();
      await storage.disconnect();
    }
  }
);

// ==================== MULTIPLE ALERTS TEST ====================

Deno.test("Multiple Alerts - Should trigger only matching ones", async () => {
  const storage = new AlertStorage();
  await storage.connect();

  try {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();

    // Add 3 alerts: $50, $100, $150
    const alert1: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Alert 50",
      action: "BUY",
      price: 50.0,
      exchanges: ["BINANCE"],
      isActive: true,
      category: 1,
    };

    const alert2: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Alert 100",
      action: "BUY",
      price: 100.0,
      exchanges: ["BINANCE"],
      isActive: true,
      category: 1,
    };

    const alert3: LineAlert = {
      id: uuidv4(),
      symbol: "BTCUSDT",
      alertName: "Alert 150",
      action: "BUY",
      price: 150.0,
      exchanges: ["BINANCE"],
      isActive: true,
      category: 1,
    };

    await storage.addWorkingLineAlert(alert1);
    await storage.addWorkingLineAlert(alert2);
    await storage.addWorkingLineAlert(alert3);

    // Candle crosses only $100 (not $50 or $150)
    const candle = createCandle(90, 110, 85, 105, Date.now());
    const marketData = createMarketData("BTCUSDT", [candle]);

    // Run checker
    await runAlertChecks(marketData, storage);

    // Assert: only $100 should trigger
    const triggered = await storage.getTriggeredLineAlerts();
    assertEquals(triggered.length, 1);
    assertEquals(triggered[0].price, 100.0);
  } finally {
    await storage.removeAllWorkingLineAlerts();
    await storage.removeAllTriggeredLineAlerts();
    await storage.disconnect();
  }
});
