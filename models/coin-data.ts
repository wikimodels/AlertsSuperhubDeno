export interface CoinData {
  symbol: string; // "BTC/USDT:USDT"
  full_symbol: string;
  name: string;
  quoteCurrency: string;
  exchanges: string[]; // Список бирж
  logoUrl: string;
  analyzed_at: { $date: string }; // Время анализа
  category: number;

  // --- Market Metrics ---
  usdPrice: number;
  volume_24h_usd: number;
  volume24h: number;
  change24h: number;

  // --- Индикаторы Hurst, Entropy (1h, 2h, 4h, 12h, 1d) ---
  hurst_1h: number;
  hurst_2h: number;
  hurst_4h: number;
  hurst_12h: number;
  hurst_1d: number;

  entropy_1h: number;
  entropy_2h: number;
  entropy_4h: number;
  entropy_12h: number;
  entropy_1d: number;

  // --- Trend/MR Quality (w20) ---
  trend_quality_1h_w20: number;
  mr_quality_1h_w20: number;
  trend_quality_2h_w20: number;
  mr_quality_2h_w20: number;
  trend_quality_4h_w20: number;
  mr_quality_4h_w20: number;
  trend_quality_12h_w20: number;
  mr_quality_12h_w20: number;
  trend_quality_1d_w20: number;
  mr_quality_1d_w20: number;

  // --- Swing Quality / Movement Efficiency / Fractal Dimension ---
  swing_quality_1h_w5: number;
  movement_efficiency_1h: number;
  fractal_dimension_1h: number;
  swing_quality_2h_w5: number;
  movement_efficiency_2h: number;
  fractal_dimension_2h: number;
  swing_quality_4h_w5: number;
  movement_efficiency_4h: number;
  fractal_dimension_4h: number;
  swing_quality_12h_w5: number;
  movement_efficiency_12h: number;
  fractal_dimension_12h: number;
  swing_quality_1d_w5: number;
  movement_efficiency_1d: number;
  fractal_dimension_1d: number;

  // --- Jagginess/Smoothness (w20) ---
  jagginess_1h_w20: number;
  smoothness_index_1h_w20: number;
  jagginess_2h_w20: number;
  smoothness_index_2h_w20: number;
  jagginess_4h_w20: number;
  smoothness_index_4h_w20: number;
  jagginess_12h_w20: number;
  smoothness_index_12h_w20: number;
  jagginess_1d_w20: number;
  smoothness_index_1d_w20: number;

  // --- Skewness/Kurtosis (w50) ---
  skewness_1h_w50: number;
  kurtosis_1h_w50: number;
  skewness_2h_w50: number;
  kurtosis_2h_w50: number;
  skewness_4h_w50: number;
  kurtosis_4h_w50: number;
  skewness_12h_w50: number;
  kurtosis_12h_w50: number;
  skewness_1d_w50: number;
  kurtosis_1d_w50: number;

  // --- Movement Intensity, ATR, MCI, ADX, DI+ (w14, 90d) ---
  movement_intensity_1h_w14: number;
  atr_stability_1h_w14: number;
  mci_1h: number;
  adx_above_25_pct_90d_1h: number;
  di_plus_dominant_pct_90d_1h: number;

  movement_intensity_2h_w14: number;
  atr_stability_2h_w14: number;
  mci_2h: number;
  adx_above_25_pct_90d_2h: number;
  di_plus_dominant_pct_90d_2h: number;

  movement_intensity_4h_w14: number;
  atr_stability_4h_w14: number;
  mci_4h: number;
  adx_above_25_pct_90d_4h: number;
  di_plus_dominant_pct_90d_4h: number;

  movement_intensity_12h_w14: number;
  atr_stability_12h_w14: number;
  mci_12h: number;
  adx_above_25_pct_90d_12h: number;
  di_plus_dominant_pct_90d_12h: number;

  movement_intensity_1d_w14: number;
  atr_stability_1d_w14: number;
  mci_1d: number;
  adx_above_25_pct_90d_1d: number;
  di_plus_dominant_pct_90d_1d: number;

  // --- Correlation Fields ---
  btc_corr_1d_w30: number;
  btc_corr_stability_current_correlation: number;
  btc_corr_stability_correlation_std: number;
  btc_corr_stability_correlation_stability_score: number;
}

export interface CoinDataResponse {
  count: number;
  data: CoinData[];
}
