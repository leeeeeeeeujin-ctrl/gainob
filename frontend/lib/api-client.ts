import type { LiquidityDashboardPayload } from "@/types/liquidity-dashboard";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export function buildPublicApiUrl(path: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  const url = new URL(`${apiBaseUrl}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return `${url.pathname}${url.search}${apiBaseUrl ? "" : ""}`.startsWith("/api")
    ? `${apiBaseUrl}${url.pathname}${url.search}`
    : url.toString();
}

export async function fetchLiquidityDashboard(): Promise<LiquidityDashboardPayload> {
  const response = await fetch(buildPublicApiUrl("/api/public/liquidity-dashboard"), {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Liquidity dashboard request failed: ${response.status}`);
  }

  return response.json();
}
