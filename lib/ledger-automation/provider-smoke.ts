import { createLiveLedgerAdapter } from "./live-adapters";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import type { LedgerLiveProvider, LedgerSourceAdapter, LedgerSourceDefinition } from "./types";

export const LEDGER_SMOKE_PROVIDERS = Object.freeze([
  "BEA_PERSONAL_INCOME",
  "EIA_PETROLEUM",
  "EIA_STEO",
  "EIA_ELECTRICITY",
  "FRED_FINANCIAL_STRESS",
  "BLS_EMPLOYMENT",
  "BLS_JOLTS",
  "TREASURY_YIELD_CURVE",
] as const satisfies readonly LedgerLiveProvider[]);

export type LedgerProviderSmokeResult = {
  provider: LedgerLiveProvider;
  sourceId: string;
  outcome: "SUCCESS" | "FAILURE";
  status: string;
  failureCode: string | null;
  observationDate: string | null;
  freshness: string;
  normalizationResult: string | null;
};

function sourcesByProvider(registry: readonly LedgerSourceDefinition[]): Map<LedgerLiveProvider, LedgerSourceDefinition> {
  const sources = new Map<LedgerLiveProvider, LedgerSourceDefinition>();
  for (const source of registry) {
    if (source.sourceMode === "LIVE" && source.liveProvider && !sources.has(source.liveProvider)) {
      sources.set(source.liveProvider, source);
    }
  }
  return sources;
}

export async function runLedgerProviderSmoke(input: {
  adapter?: LedgerSourceAdapter;
  registry?: readonly LedgerSourceDefinition[];
  now?: Date;
} = {}): Promise<readonly LedgerProviderSmokeResult[]> {
  const checkedAt = (input.now ?? new Date()).toISOString();
  const adapter = input.adapter ?? createLiveLedgerAdapter({ logger: () => undefined });
  const sources = sourcesByProvider(input.registry ?? LEDGER_SOURCE_REGISTRY);

  return Promise.all(LEDGER_SMOKE_PROVIDERS.map(async (provider) => {
    const source = sources.get(provider);
    if (!source) throw new Error(`Approved Ledger registry has no live source for ${provider}.`);
    const check = await adapter.check(source, { runType: "TUESDAY_FULL", checkedAt, runId: "production-provider-smoke" });
    return {
      provider,
      sourceId: source.sourceId,
      outcome: check.failure ? "FAILURE" : "SUCCESS",
      status: check.status,
      failureCode: check.failure?.code ?? null,
      observationDate: check.observationTimestamp,
      freshness: check.freshness,
      normalizationResult: check.normalizedObservation?.summary ?? null,
    };
  }));
}
