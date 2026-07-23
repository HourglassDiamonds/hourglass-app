import type { Ga4WeeklyBundle } from "@/lib/intelligence/types";
import type { GscWeeklyBundle } from "@/lib/integrations/gsc";
import type { WeeklyReportRecord } from "@/lib/intelligence/types";
import type { DataSourceId, SourceHealth } from "../types";

export type AdapterMode = "fixture" | "live";

export type AdapterResult<T> = {
  sourceId: DataSourceId;
  ok: boolean;
  data: T | null;
  health: SourceHealth;
  /** empty vs failed are distinct */
  empty: boolean;
  failed: boolean;
};

export type AgentOsDataBundle = {
  ga4: AdapterResult<Ga4WeeklyBundle>;
  gsc: AdapterResult<GscWeeklyBundle>;
  weeklyIntelligence: AdapterResult<WeeklyReportRecord>;
  hubspotAggregates: AdapterResult<null>;
  buffer: AdapterResult<null>;
  gbp: AdapterResult<null>;
};

export const DEFAULT_ADAPTER_TIMEOUT_MS = 12_000;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
