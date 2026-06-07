export type RotationStatus = "Bullish" | "Neutral" | "Bearish" | "Unavailable";

export type MetricPoint = {
  timestamp: string;
  value: number;
};

export type ChangeSet = {
  "1d": number | null;
  "1w": number | null;
  "1m": number | null;
  "3m": number | null;
};

export type RegimeMetric = {
  id: string;
  label: string;
  unit: string;
  current: number | null;
  changes: ChangeSet;
  description: string;
  source?: string;
  status?: string;
  error?: string | null;
  series: MetricPoint[];
};

export type RotationMetric = {
  id: string;
  label: string;
  unit: string;
  current: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  status: RotationStatus;
  source?: string;
  error?: string | null;
  series: MetricPoint[];
};

export type FlowMetric = {
  id: string;
  label: string;
  unit: string;
  current: number | null;
  currentWeek: number | null;
  sum30d: number | null;
  sum90d: number | null;
  description: string;
  source?: string;
  status?: string;
  error?: string | null;
  series: MetricPoint[];
};

export type LiquidityDashboardPayload = {
  asOf: string;
  provider: {
    id: string;
    name: string;
    mode: "real" | "live";
    sources?: string[];
    cacheTtlSeconds?: number;
    note: string;
  };
  scope: {
    purpose: "briefing";
    excludes: string[];
  };
  marketRegime: RegimeMetric[];
  cycleRotation: RotationMetric[];
  cryptoLiquidity: RegimeMetric[];
  etfFlows: FlowMetric[];
  marketSize: RegimeMetric[];
  capitalFlow: {
    stablecoins: RegimeMetric[];
    etfFlows: FlowMetric[];
    marketSize: RegimeMetric[];
  };
  capitalFlowSummary: string[];
};
