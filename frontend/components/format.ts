export function formatMetric(value: number | null, unit: string) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  if (unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  if (unit === "USD") {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value);
  }

  if (unit === "USD/day") {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 2,
      signDisplay: "exceptZero"
    }).format(value);
  }

  return value.toFixed(value < 1 ? 4 : 2);
}

export function formatChange(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
