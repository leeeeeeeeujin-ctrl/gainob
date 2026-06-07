import type { RotationMetric } from "@/types/liquidity-dashboard";
import { formatMetric } from "@/components/format";

type Props = {
  items: RotationMetric[];
};

const statusClass = {
  Bullish: "bg-emerald-50 text-moss ring-emerald-200",
  Neutral: "bg-amber-50 text-amberline ring-amber-200",
  Bearish: "bg-rose-50 text-brick ring-rose-200",
  Unavailable: "bg-slate-100 text-slate-500 ring-slate-200"
};

export function RotationTable({ items }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className="grid grid-cols-[1.1fr_repeat(5,0.8fr)] border-b border-line bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
        <span>Metric</span>
        <span className="text-right">Current</span>
        <span className="text-right">20D MA</span>
        <span className="text-right">50D MA</span>
        <span className="text-right">200D MA</span>
        <span className="text-right">State</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[1.1fr_repeat(5,0.8fr)] items-center border-b border-line px-4 py-3 text-sm last:border-b-0">
          <span className="font-semibold text-ink">{item.label}</span>
          <span className="text-right tabular-nums">{formatMetric(item.current, item.unit)}</span>
          <span className="text-right tabular-nums">{formatMetric(item.ma20, item.unit)}</span>
          <span className="text-right tabular-nums">{formatMetric(item.ma50, item.unit)}</span>
          <span className="text-right tabular-nums">{formatMetric(item.ma200, item.unit)}</span>
          <span className="text-right">
            <span className={`inline-flex min-w-20 justify-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass[item.status]}`}>
              {item.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
