import { MarketData } from "./types.ts";

export interface KlineApiResponse {
  success: boolean;
  data: MarketData;
  error?: string;
}
