"use client";

import { create } from "zustand";
import { fetchLiquidityDashboard } from "@/lib/api-client";
import type { LiquidityDashboardPayload } from "@/types/liquidity-dashboard";

type DashboardState = {
  data: LiquidityDashboardPayload | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  async load() {
    set({ loading: true, error: null });

    try {
      set({ data: await fetchLiquidityDashboard(), loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown dashboard error",
        loading: false
      });
    }
  }
}));
