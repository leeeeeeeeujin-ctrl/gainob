import type { MetricPoint } from "@/types/liquidity-dashboard";

export interface LiquidityDashboardProvider {
  getBTCDominance(): Promise<MetricPoint[]>;
  getETHBTC(): Promise<MetricPoint[]>;
  getSOLETH(): Promise<MetricPoint[]>;
  getStablecoinMarketCap(): Promise<MetricPoint[]>;
  getETFNetFlow(asset: "BTC" | "ETH"): Promise<MetricPoint[]>;
}
