"use client";

import { useEffect } from "react";
import { FlowChart } from "@/components/FlowChart";
import { MetricCard } from "@/components/MetricCard";
import { PublicEndpointConsole } from "@/components/PublicEndpointConsole";
import { RotationTable } from "@/components/RotationTable";
import { formatMetric } from "@/components/format";
import { useDashboardStore } from "@/store/dashboard-store";

export default function DashboardPage() {
  const { data, loading, error, load } = useDashboardStore();

  useEffect(() => {
    void load();
  }, [load]);

  const stablecoinCap = data?.cryptoLiquidity.find((metric) => metric.id === "stablecoin-market-cap");
  const btcEtfFlow = data?.etfFlows.find((metric) => metric.id === "btc-etf-net-flow");
  const ethEtfFlow = data?.etfFlows.find((metric) => metric.id === "eth-etf-net-flow");

  return (
    <main className="min-h-screen bg-paper px-5 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Gainob Liquidity Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink md:text-4xl">Market Liquidity Briefing</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              가격 예측 없이 BTC Dominance, 주요 상대강도, 스테이블 유동성, ETF 흐름만 요약합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-80">
            <div className="rounded-lg border border-line bg-white px-3 py-2">
              <div className="text-xs text-slate-500">Provider</div>
              <div className="mt-1 font-semibold text-ink">{data?.provider.name ?? "Loading"}</div>
            </div>
            <div className="rounded-lg border border-line bg-white px-3 py-2">
              <div className="text-xs text-slate-500">As of</div>
              <div className="mt-1 font-semibold text-ink">{data ? new Date(data.asOf).toLocaleString("ko-KR") : "-"}</div>
            </div>
          </div>
        </header>

        {loading && <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">Loading liquidity dashboard...</div>}
        {error && <div className="rounded-lg border border-brick bg-rose-50 p-4 text-sm font-semibold text-brick">{error}</div>}

        {data && (
          <>
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Market Regime Panel</h2>
                  <p className="text-sm text-slate-500">MVP scope: BTC Dominance only</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data.provider.mode.toUpperCase()}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.marketRegime.map((metric) => (
                  <MetricCard key={metric.id} metric={metric} />
                ))}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-ink">Cycle Rotation</h2>
                  <p className="text-sm text-slate-500">ETH/BTC와 SOL/ETH의 이동평균 기반 자동 상태 판정</p>
                </div>
                <RotationTable items={data.cycleRotation} />
              </div>

              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-ink">Liquidity Snapshot</h2>
                  <p className="text-sm text-slate-500">현금성 유동성과 ETF 30일 합계</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                    <div className="text-xs text-slate-500">Stablecoin Market Cap</div>
                    <div className="mt-1 text-2xl font-semibold text-ink">{stablecoinCap ? formatMetric(stablecoinCap.current, stablecoinCap.unit) : "-"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                      <div className="text-xs text-slate-500">BTC ETF 30D</div>
                      <div className="mt-1 text-xl font-semibold text-moss">{btcEtfFlow ? formatMetric(btcEtfFlow.sum30d, "USD/day") : "-"}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
                      <div className="text-xs text-slate-500">ETH ETF 30D</div>
                      <div className="mt-1 text-xl font-semibold text-brick">{ethEtfFlow ? formatMetric(ethEtfFlow.sum30d, "USD/day") : "-"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              {stablecoinCap && <FlowChart title="Stablecoin Market Cap" metric={stablecoinCap} />}
              {btcEtfFlow && <FlowChart title="BTC ETF Net Flow" metric={btcEtfFlow} type="bar" />}
              {ethEtfFlow && <FlowChart title="ETH ETF Net Flow" metric={ethEtfFlow} type="bar" />}
            </section>

            <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Capital Flow Summary</h2>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amberline ring-1 ring-amber-200">Rule-based</span>
              </div>
              <div className="grid gap-2 text-sm leading-6 text-slate-700">
                {data.capitalFlowSummary.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>

            <PublicEndpointConsole />
          </>
        )}
      </div>
    </main>
  );
}
