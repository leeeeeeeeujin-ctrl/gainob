import type { RegimeMetric } from "@/types/liquidity-dashboard";
import { formatChange, formatMetric } from "@/components/format";

type Props = {
  metric: RegimeMetric;
};

export function MetricCard({ metric }: Props) {
  const changeItems = [
    ["1D", metric.changes["1d"]],
    ["1W", metric.changes["1w"]],
    ["1M", metric.changes["1m"]],
    ["3M", metric.changes["3m"]]
  ] as const;

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{metric.label}</h3>
          <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
        </div>
        <div className="text-right text-2xl font-semibold tabular-nums text-ink">{formatMetric(metric.current, metric.unit)}</div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {changeItems.map(([label, value]) => (
          <div key={label} className="border-l border-line pl-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`mt-1 text-sm font-semibold tabular-nums ${Number(value) >= 0 ? "text-moss" : "text-brick"}`}>
              {formatChange(value)}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
