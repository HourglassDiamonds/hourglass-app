import { approvedSnapshotAdapter } from "./adapters";
import type {
  LedgerAdapterContext,
  LedgerLiveProvider,
  LedgerSourceAdapter,
  LedgerSourceCheck,
  LedgerSourceDefinition,
  LedgerSourceStatus,
  SourceFreshness,
} from "./types";

const USER_AGENT = "Hourglass-Ledger/1.1 (+https://hourglassdiamonds.com/ledger)";
const MAX_RESPONSE_BYTES = 1_000_000;

const PROVIDER_URLS: Readonly<Record<LedgerLiveProvider, string>> = {
  BEA_PERSONAL_INCOME: "https://apps.bea.gov/api/data",
  BLS_EMPLOYMENT: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
  BLS_JOLTS: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
  EIA_PETROLEUM: "https://api.eia.gov/v2/petroleum/sum/sndw/data/",
  EIA_STEO: "https://api.eia.gov/v2/steo/data/",
  EIA_ELECTRICITY: "https://api.eia.gov/v2/electricity/rto/region-data/data/",
  TREASURY_YIELD_CURVE:
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml",
  FRED_HIGH_YIELD_OAS: "https://api.stlouisfed.org/fred/series/observations",
  FRED_FINANCIAL_STRESS: "https://api.stlouisfed.org/fred/series/observations",
};

type FetchLike = typeof fetch;
type LogEvent = Readonly<Record<string, unknown>>;
type AdapterLogger = (event: LogEvent) => void;

export type LiveAdapterOptions = {
  fetchImpl?: FetchLike;
  env?: Readonly<Record<string, string | undefined>>;
  timeoutMs?: number;
  maxAttempts?: number;
  logger?: AdapterLogger;
};

type ParsedObservation = {
  observationTimestamp: string;
  rawValue: unknown;
  rawPayload: unknown;
  unit: string | null;
  metadata?: Readonly<Record<string, unknown>>;
};

class AdapterFailure extends Error {
  constructor(
    readonly status: LedgerSourceStatus,
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function sourceFreshness(observationTimestamp: string, checkedAt: string, maxAgeDays: number): SourceFreshness {
  const observed = Date.parse(observationTimestamp);
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(checked)) return "UNKNOWN";
  const ageDays = Math.max(0, (checked - observed) / 86_400_000);
  return ageDays <= maxAgeDays ? "CURRENT" : "STALE";
}

function requireIso(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new AdapterFailure("INVALID", "INVALID_TIMESTAMP", "Source returned an invalid observation timestamp.", false);
  }
  return new Date(parsed).toISOString();
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""));
  if (!Number.isFinite(parsed)) {
    throw new AdapterFailure("INVALID", "INVALID_VALUE", "Source returned a non-numeric observation.", false);
  }
  return parsed;
}

function monthTimestamp(year: unknown, period: unknown): string {
  const month = /^M(0[1-9]|1[0-2])$/.exec(String(period))?.[1];
  if (!/^\d{4}$/.test(String(year)) || !month) {
    throw new AdapterFailure("INVALID", "INVALID_TIMESTAMP", "Source returned an invalid monthly period.", false);
  }
  return requireIso(`${year}-${month}-01T00:00:00.000Z`);
}

function redactUrl(value: URL): string {
  const copy = new URL(value);
  copy.searchParams.delete("api_key");
  copy.searchParams.delete("UserID");
  return copy.toString();
}

async function request(
  url: URL,
  options: LiveAdapterOptions,
  responseKind: "json" | "xml",
  init?: RequestInit,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
  const timeoutMs = Math.max(100, Math.min(options.timeoutMs ?? 8_000, 30_000));
  let lastFailure: AdapterFailure | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: responseKind === "json" ? "application/json" : "application/xml,text/xml",
          "User-Agent": USER_AGENT,
          ...(init?.headers ?? {}),
        },
      });
      if (response.status === 429) {
        throw new AdapterFailure("RATE_LIMITED", "RATE_LIMITED", "Source rate limit was reached.", true);
      }
      if (!response.ok) {
        throw new AdapterFailure(
          "UNAVAILABLE",
          `HTTP_${response.status}`,
          `Source returned HTTP ${response.status}.`,
          response.status >= 500,
        );
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (responseKind === "json" && !contentType.includes("json")) {
        throw new AdapterFailure("INVALID", "INVALID_CONTENT_TYPE", "Source did not return JSON.", false);
      }
      if (responseKind === "xml" && !contentType.includes("xml")) {
        throw new AdapterFailure("INVALID", "INVALID_CONTENT_TYPE", "Source did not return XML.", false);
      }
      const body = await response.text();
      if (body.length > MAX_RESPONSE_BYTES) {
        throw new AdapterFailure("INVALID", "PAYLOAD_TOO_LARGE", "Source payload exceeded the configured limit.", false);
      }
      if (responseKind === "xml") return body;
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new AdapterFailure("INVALID", "MALFORMED_JSON", "Source returned malformed JSON.", false);
      }
    } catch (error) {
      const failure = error instanceof AdapterFailure
        ? error
        : error instanceof Error && error.name === "AbortError"
          ? new AdapterFailure("UNAVAILABLE", "TIMEOUT", "Source request timed out.", true)
          : new AdapterFailure("UNAVAILABLE", "NETWORK_ERROR", "Source request failed.", true);
      lastFailure = failure;
      if (!failure.retryable || attempt === attempts) throw failure;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastFailure ?? new AdapterFailure("UNAVAILABLE", "UNKNOWN", "Source request failed.", false);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdapterFailure("INVALID", "INVALID_SCHEMA", "Source response did not match the expected schema.", false);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new AdapterFailure("INVALID", "INVALID_SCHEMA", "Source response did not match the expected schema.", false);
  }
  return value;
}

function parseBls(payload: unknown, expectedSeries: readonly string[]): ParsedObservation {
  const root = asRecord(payload);
  if (root.status !== "REQUEST_SUCCEEDED") {
    throw new AdapterFailure("UNAVAILABLE", "SOURCE_REJECTED", "BLS did not accept the request.", true);
  }
  const series = asArray(asRecord(root.Results).series);
  const values: Record<string, number> = {};
  const timestamps: string[] = [];
  for (const seriesId of expectedSeries) {
    const row = series.map(asRecord).find((item) => item.seriesID === seriesId);
    if (!row) throw new AdapterFailure("INVALID", "MISSING_SERIES", `BLS omitted approved series ${seriesId}.`, false);
    const datum = asRecord(asArray(row.data)[0]);
    values[seriesId] = numeric(datum.value);
    timestamps.push(monthTimestamp(datum.year, datum.period));
  }
  const observationTimestamp = timestamps.sort()[0];
  if (!observationTimestamp) throw new AdapterFailure("INVALID", "MISSING_OBSERVATION", "BLS returned no data.", false);
  return { observationTimestamp, rawValue: values, rawPayload: values, unit: "mixed BLS published units" };
}

function parseBea(payload: unknown): ParsedObservation {
  const data = asArray(asRecord(asRecord(asRecord(payload).BEAAPI).Results).Data).map(asRecord);
  const latestPeriod = data.map((row) => String(row.TimePeriod ?? "")).sort().at(-1);
  if (!latestPeriod || !/^\d{4}M(0[1-9]|1[0-2])$/.test(latestPeriod)) {
    throw new AdapterFailure("INVALID", "INVALID_TIMESTAMP", "BEA returned no valid monthly period.", false);
  }
  const selected = data.filter((row) => row.TimePeriod === latestPeriod && ["37", "58"].includes(String(row.LineNumber)));
  if (selected.length === 0) {
    throw new AdapterFailure("INVALID", "MISSING_OBSERVATION", "BEA omitted the approved personal-income lines.", false);
  }
  const rawValue = Object.fromEntries(selected.map((row) => [String(row.LineDescription ?? row.LineNumber), numeric(row.DataValue)]));
  const [year, month] = latestPeriod.split("M");
  return {
    observationTimestamp: requireIso(`${year}-${month}-01T00:00:00.000Z`),
    rawValue,
    rawPayload: rawValue,
    unit: "BEA published units",
  };
}

function parseEia(payload: unknown): ParsedObservation {
  const rows = asArray(asRecord(asRecord(payload).response).data).map(asRecord);
  if (rows.length === 0) throw new AdapterFailure("INVALID", "MISSING_OBSERVATION", "EIA returned no data.", false);
  const latestPeriod = rows.map((row) => String(row.period ?? "")).filter(Boolean).sort().at(-1);
  const selected = rows.filter((row) => String(row.period) === latestPeriod).slice(0, 25);
  if (!latestPeriod || selected.length === 0) {
    throw new AdapterFailure("INVALID", "INVALID_TIMESTAMP", "EIA returned no valid period.", false);
  }
  const rawValue = selected.map((row) => ({
    series: row["series-description"] ?? row.seriesId ?? row.respondent ?? "series",
    value: numeric(row.value),
    unit: String(row.units ?? row.unit ?? ""),
  }));
  if (rawValue.some((row) => !row.unit)) {
    throw new AdapterFailure("INVALID", "INVALID_UNIT", "EIA returned an empty unit.", false);
  }
  return {
    observationTimestamp: requireIso(/^\d{4}-\d{2}-\d{2}$/.test(latestPeriod) ? `${latestPeriod}T00:00:00.000Z` : `${latestPeriod}-01T00:00:00.000Z`),
    rawValue,
    rawPayload: rawValue,
    unit: [...new Set(rawValue.map((row) => row.unit))].join(", "),
  };
}

function parseFred(payload: unknown, seriesId: string): ParsedObservation {
  const observations = asArray(asRecord(payload).observations).map(asRecord);
  const row = observations.find((item) => item.value !== ".");
  if (!row) throw new AdapterFailure("INVALID", "MISSING_OBSERVATION", "FRED returned no current observation.", false);
  return {
    observationTimestamp: requireIso(`${String(row.date)}T00:00:00.000Z`),
    rawValue: numeric(row.value),
    rawPayload: { seriesId, date: row.date, value: row.value },
    unit: seriesId === "BAMLH0A0HYM2" ? "percent" : "index",
    metadata: { seriesId },
  };
}

function parseTreasury(payload: unknown): ParsedObservation {
  if (typeof payload !== "string") {
    throw new AdapterFailure("INVALID", "INVALID_SCHEMA", "Treasury response was not XML text.", false);
  }
  const entries = [...payload.matchAll(/<entry[\s\S]*?<m:properties>([\s\S]*?)<\/m:properties>[\s\S]*?<\/entry>/g)];
  const parsed = entries.flatMap((entry) => {
    const body = entry[1] ?? "";
    const date = /<d:NEW_DATE[^>]*>([^<]+)<\/d:NEW_DATE>/.exec(body)?.[1];
    const value = /<d:BC_10YEAR[^>]*>([^<]+)<\/d:BC_10YEAR>/.exec(body)?.[1];
    return date && value ? [{ date: requireIso(date), value: numeric(value) }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const latest = parsed[0];
  if (!latest) throw new AdapterFailure("INVALID", "MISSING_OBSERVATION", "Treasury XML omitted the 10-year yield.", false);
  return { observationTimestamp: latest.date, rawValue: latest.value, rawPayload: latest, unit: "percent" };
}

function credential(source: LedgerSourceDefinition, env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (!source.credentialEnv) return undefined;
  const value = env[source.credentialEnv]?.trim();
  if (!value) throw new AdapterFailure("AUTH_REQUIRED", "MISSING_CREDENTIAL", `${source.credentialEnv} is required.`, false);
  return value;
}

async function fetchProvider(
  source: LedgerSourceDefinition,
  checkedAt: string,
  options: LiveAdapterOptions,
): Promise<{ parsed: ParsedObservation; sourceUrl: string }> {
  const provider = source.liveProvider;
  if (!provider) throw new AdapterFailure("INVALID", "MISSING_PROVIDER", "Live source has no approved provider.", false);
  const env = options.env ?? process.env;
  const secret = credential(source, env);
  const url = new URL(PROVIDER_URLS[provider]);
  let payload: unknown;

  if (provider === "BLS_EMPLOYMENT" || provider === "BLS_JOLTS") {
    const series = provider === "BLS_EMPLOYMENT"
      ? ["LNS14000000", "CES0000000001", "LNS11300000", "CES0500000002"]
      : ["JTS000000000000000JOL", "JTS000000000000000HIL", "JTS000000000000000QUR", "JTS000000000000000LDL"];
    payload = await request(url, options, "json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesid: series }),
    });
    return { parsed: parseBls(payload, series), sourceUrl: url.toString() };
  }

  if (provider === "BEA_PERSONAL_INCOME") {
    url.searchParams.set("UserID", secret ?? "");
    url.searchParams.set("method", "GetData");
    url.searchParams.set("datasetname", "NIPA");
    url.searchParams.set("TableName", "T20600");
    url.searchParams.set("Frequency", "M");
    url.searchParams.set("Year", String(new Date(checkedAt).getUTCFullYear()));
    url.searchParams.set("ResultFormat", "JSON");
    payload = await request(url, options, "json");
    return { parsed: parseBea(payload), sourceUrl: redactUrl(url) };
  }

  if (provider.startsWith("EIA_")) {
    url.searchParams.set("api_key", secret ?? "");
    url.searchParams.set("data[0]", "value");
    url.searchParams.set("sort[0][column]", "period");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("offset", "0");
    url.searchParams.set("length", "25");
    if (provider === "EIA_PETROLEUM") url.searchParams.set("frequency", "weekly");
    if (provider === "EIA_STEO") {
      url.searchParams.set("frequency", "monthly");
      url.searchParams.append("facets[seriesId][]", "BREPUUS");
    }
    if (provider === "EIA_ELECTRICITY") {
      url.searchParams.set("frequency", "daily");
      url.searchParams.append("facets[respondent][]", "US48");
      url.searchParams.append("facets[type][]", "D");
    }
    payload = await request(url, options, "json");
    return { parsed: parseEia(payload), sourceUrl: redactUrl(url) };
  }

  if (provider === "TREASURY_YIELD_CURVE") {
    url.searchParams.set("data", "daily_treasury_yield_curve");
    url.searchParams.set("field_tdr_date_value", String(new Date(checkedAt).getUTCFullYear()));
    payload = await request(url, options, "xml");
    return { parsed: parseTreasury(payload), sourceUrl: url.toString() };
  }

  const seriesId = provider === "FRED_HIGH_YIELD_OAS" ? "BAMLH0A0HYM2" : "STLFSI4";
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", secret ?? "");
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "10");
  payload = await request(url, options, "json");
  return { parsed: parseFred(payload, seriesId), sourceUrl: redactUrl(url) };
}

function baseCheck(source: LedgerSourceDefinition, context: LedgerAdapterContext): Omit<LedgerSourceCheck,
  "observationTimestamp" | "rawObservation" | "rawValue" | "rawPayload" | "normalizedObservation" |
  "normalizedValue" | "unit" | "freshness" | "sourceFreshness" | "status" | "failure" |
  "failureReason" | "metadata"> {
  return {
    sourceId: source.sourceId,
    monitorId: source.monitorId,
    bufferDomainId: source.bufferDomainId,
    sourceName: source.sourceName,
    sourceAuthority: source.sourceAuthority,
    sourceLocation: source.sourceLocation,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    sourceMode: source.sourceMode,
    checkedAt: context.checkedAt,
    fetchedAt: context.checkedAt,
    reliability: source.reliability,
    confidence: source.reliability,
    required: source.required,
    contradictorySourceIds: [],
  };
}

function failureCheck(
  source: LedgerSourceDefinition,
  context: LedgerAdapterContext,
  failure: AdapterFailure,
  durationMs: number,
): LedgerSourceCheck {
  return {
    ...baseCheck(source, context),
    observationTimestamp: null,
    rawObservation: null,
    rawValue: null,
    rawPayload: null,
    normalizedObservation: null,
    normalizedValue: null,
    unit: null,
    freshness: "UNKNOWN",
    sourceFreshness: "UNKNOWN",
    status: failure.status,
    failure: { code: failure.code, message: failure.message, retryable: failure.retryable },
    failureReason: failure.message,
    metadata: { adapterId: "ledger-live-hybrid-v1.1", durationMs, provider: source.liveProvider ?? null },
  };
}

export function createLiveLedgerAdapter(options: LiveAdapterOptions = {}): LedgerSourceAdapter {
  const logger = options.logger ?? ((event) => console.info(JSON.stringify(event)));
  const runCache = new Map<string, Promise<{ parsed: ParsedObservation; sourceUrl: string }>>();
  return {
    adapterId: "ledger-live-hybrid-v1.1",
    async check(source, context) {
      if (source.sourceMode !== "LIVE") {
        const manual = await approvedSnapshotAdapter.check(source, context);
        return {
          ...manual,
          status: "MANUAL_REVIEW_REQUIRED",
          metadata: { ...manual.metadata, adapterId: "ledger-live-hybrid-v1.1", fallback: "manual-approved" },
        };
      }
      const started = Date.now();
      logger({ event: "ledger.adapter.start", runId: context.runId ?? null, sourceId: source.sourceId });
      try {
        const cacheKey = `${context.runId ?? context.checkedAt}:${source.liveProvider ?? source.sourceId}`;
        const pending = runCache.get(cacheKey) ?? fetchProvider(source, context.checkedAt, options);
        runCache.set(cacheKey, pending);
        const { parsed, sourceUrl } = await pending;
        const freshness = sourceFreshness(parsed.observationTimestamp, context.checkedAt, source.maxAgeDays);
        const durationMs = Date.now() - started;
        const status: LedgerSourceStatus = freshness === "STALE" ? "STALE" : "MANUAL_REVIEW_REQUIRED";
        logger({
          event: freshness === "STALE" ? "ledger.adapter.stale" : "ledger.adapter.success",
          runId: context.runId ?? null,
          sourceId: source.sourceId,
          durationMs,
          status,
        });
        const summary = `Live ${source.sourceAuthority} observation captured; Ledger interpretation requires manual review.`;
        return {
          ...baseCheck(source, context),
          sourceUrl,
          observationTimestamp: parsed.observationTimestamp,
          rawObservation: JSON.stringify(parsed.rawValue),
          rawValue: parsed.rawValue,
          rawPayload: parsed.rawPayload,
          normalizedObservation: { summary, significance: "NONE" },
          normalizedValue: { summary, interpretation: "MANUAL_REVIEW_REQUIRED" },
          unit: parsed.unit,
          freshness,
          sourceFreshness: freshness,
          status,
          failure: null,
          failureReason: null,
          metadata: {
            adapterId: "ledger-live-hybrid-v1.1",
            durationMs,
            provider: source.liveProvider,
            ...(parsed.metadata ?? {}),
          },
        };
      } catch (error) {
        const failure = error instanceof AdapterFailure
          ? error
          : new AdapterFailure("UNAVAILABLE", "UNEXPECTED", "Unexpected adapter failure.", false);
        const durationMs = Date.now() - started;
        logger({
          event: "ledger.adapter.failure",
          runId: context.runId ?? null,
          sourceId: source.sourceId,
          durationMs,
          status: failure.status,
          code: failure.code,
        });
        return failureCheck(source, context, failure, durationMs);
      }
    },
  };
}

export const liveLedgerAdapter = createLiveLedgerAdapter();

export const APPROVED_LIVE_SOURCE_URLS = Object.freeze(Object.values(PROVIDER_URLS));
