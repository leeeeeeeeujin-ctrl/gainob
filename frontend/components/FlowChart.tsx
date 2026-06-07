"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { FlowMetric, RegimeMetric } from "@/types/liquidity-dashboard";
import { formatMetric } from "@/components/format";

type Props = {
  title: string;
  metric: RegimeMetric | FlowMetric;
  type?: "area" | "bar";
};

function chartData(metric: RegimeMetric | FlowMetric) {
  return metric.series.slice(-90).map((item) => ({
    date: item.timestamp.slice(5, 10),
    value: item.value
  }));
}

export function FlowChart({ title, metric, type = "area" }: Props) {
  const data = chartData(metric);
  const isBar = type === "bar";

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
        </div>
        <div className="text-right text-lg font-semibold tabular-nums text-ink">{formatMetric(metric.current, metric.unit)}</div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {isBar ? (
            <BarChart data={data}>
              <CartesianGrid stroke="#e6ebe4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={(value) => formatMetric(Number(value), metric.unit)} />
              <Tooltip formatter={(value) => formatMetric(Number(value), metric.unit)} labelClassName="text-xs" />
              <Bar dataKey="value" fill="#2f7668" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid stroke="#e6ebe4" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={(value) => formatMetric(Number(value), metric.unit)} />
              <Tooltip formatter={(value) => formatMetric(Number(value), metric.unit)} labelClassName="text-xs" />
              <Area type="monotone" dataKey="value" stroke="#2f7668" fill="#2f7668" fillOpacity={0.16} strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
