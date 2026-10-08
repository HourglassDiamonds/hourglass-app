import { CONCIERGE_SOL_RESPONSES_ENDPOINT } from "@/lib/continuum/concierge-sol/models";
import { parseSterlingTodayProposal, STERLING_TODAY_OUTPUT_SCHEMA } from "./schema";
import { STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal, type SterlingTodayWorkingSet } from "./types";

export const STERLING_TODAY_PROMPT_VERSION = "sterling-today-reasoning-v1" as const;
export const STERLING_TODAY_TIMEOUT_MS = 180_000;
export const STERLING_TODAY_TIMEOUT_ENV = "CONTINUUM_STERLING_TODAY_TIMEOUT_MS" as const;

const INSTRUCTIONS = [
  "You are Sterling, the primary intelligence layer for Continuum Today.",
  "Reason directly from the complete bounded working set. Work chronologically and semantically.",
  "Newer material evidence supersedes older evidence. Founder directives supersede inference.",
  "Actual fulfillment closes prior promises. Production/order evidence supersedes design-stage assumptions.",
  "Separate project stage from individual obligations. A production project may still have a founder obligation.",
  "Never assume an external email contact is a client. Classify the relationship role from canonical evidence.",
  "Newsletter, editorial, footer, quoted history, shipping boilerplate, schema fragments, technician notices, generic please language, naked place-order language, and cold solicitations are not Today actions.",
  "If evidence is ambiguous, preserve current canonical state, record the ambiguity, and propose no mutation.",
  "An unavailable or disabled calendar means unknown calendar context, not confirmation that no events exist.",
  "Evidence-backed active work without a canonical project may be surfaced provisionally with projectId null. Explain that it is provisional, cite exact evidence, and propose no canonical mutation for it.",
  "Every conclusion must cite evidenceId values from the working set. Do not invent identifiers.",
  "Presentation recommendations and canonical mutations are separate. Mutations are proposals only and always require founder approval.",
  "Use the exact runId and evidenceSnapshotId supplied. Return only the strict structured object.",
].join(" ");

type ResponsesError = { code?: unknown; message?: unknown; param?: unknown; type?: unknown };
type ResponsesBody = { status?: string; error?: ResponsesError | null; output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  output?: Array<{ type?: string; status?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };

export class SterlingTodayRequestError extends Error {
  readonly kind: "timeout" | "api" | "network" | "response";
  readonly status: number | null;
  readonly code: string | null;
  readonly apiType: string | null;
  readonly param: string | null;
  readonly requestId: string | null;
  readonly elapsedMs: number;

  constructor(input: {
    kind: SterlingTodayRequestError["kind"];
    elapsedMs: number;
    status?: number | null;
    code?: string | null;
    apiType?: string | null;
    param?: string | null;
    requestId?: string | null;
    timeoutMs?: number;
    cause?: unknown;
  }) {
    const diagnostics = [
      `kind=${input.kind}`,
      input.timeoutMs === undefined ? null : `timeoutMs=${input.timeoutMs}`,
      input.status == null ? null : `status=${input.status}`,
      input.code ? `code=${input.code}` : null,
      input.apiType ? `type=${input.apiType}` : null,
      input.param ? `param=${input.param}` : null,
      input.requestId ? `requestId=${input.requestId}` : null,
      `elapsedMs=${input.elapsedMs}`,
    ].filter((value): value is string => value !== null);
    super(`sterling-today-request-failed:${diagnostics.join(":")}`, { cause: input.cause });
    this.name = "SterlingTodayRequestError";
    this.kind = input.kind;
    this.status = input.status ?? null;
    this.code = input.code ?? null;
    this.apiType = input.apiType ?? null;
    this.param = input.param ?? null;
    this.requestId = input.requestId ?? null;
    this.elapsedMs = input.elapsedMs;
  }
}

export function resolveSterlingTodayTimeoutMs(override?: number): number {
  if (isPositiveFiniteInteger(override)) return override;
  const configured = Number(process.env[STERLING_TODAY_TIMEOUT_ENV]);
  return isPositiveFiniteInteger(configured) ? configured : STERLING_TODAY_TIMEOUT_MS;
}

export async function requestSterlingTodayProposal(input: {
  apiKey: string; model: string; workingSet: SterlingTodayWorkingSet; fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<{ proposal: SterlingTodayProposal; latencyMs: number; inputBytes: number; outputBytes: number;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } }> {
  const started = Date.now();
  const serialized = JSON.stringify(input.workingSet);
  const timeoutMs = resolveSterlingTodayTimeoutMs(input.timeoutMs);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await (input.fetchImpl ?? fetch)(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
      method: "POST", signal: controller.signal,
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: input.model, store: false, max_output_tokens: 12_000,
        instructions: `${INSTRUCTIONS} Contract: ${STERLING_TODAY_PROPOSAL_VERSION}.`, input: serialized,
        text: { format: { type: "json_schema", name: "sterling_today_proposal_v1", strict: true, schema: STERLING_TODAY_OUTPUT_SCHEMA } } }),
    });
    const requestId = response.headers.get("x-request-id");
    if (!response.ok) {
      const json = await readResponsesBody(response);
      const details = responsesErrorDetails(json?.error);
      throw new SterlingTodayRequestError({ kind: "api", status: response.status, requestId,
        elapsedMs: Date.now() - started, ...details });
    }
    const json = await readResponsesBody(response);
    if (!json) throw new SyntaxError("sterling-today-malformed");
    if (json.error || json.status === "failed" || json.status === "incomplete") {
      const details = responsesErrorDetails(json.error);
      throw new SterlingTodayRequestError({ kind: "response", status: response.status, requestId,
        elapsedMs: Date.now() - started, code: details.code ?? json.status ?? null,
        apiType: details.apiType, param: details.param });
    }
    const text = structuredText(json);
    if (!text) throw new SyntaxError("sterling-today-malformed");
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new SyntaxError("sterling-today-malformed"); }
    const proposal = parseSterlingTodayProposal(raw);
    if (!proposal) throw new SyntaxError("sterling-today-invalid-contract");
    return { proposal, latencyMs: Date.now() - started, inputBytes: Buffer.byteLength(serialized), outputBytes: Buffer.byteLength(text),
      usage: { inputTokens: json.usage?.input_tokens ?? null, outputTokens: json.usage?.output_tokens ?? null,
        totalTokens: json.usage?.total_tokens ?? null } };
  } catch (error) {
    if (error instanceof SterlingTodayRequestError || error instanceof SyntaxError) throw error;
    if (timedOut) {
      throw new SterlingTodayRequestError({ kind: "timeout", timeoutMs, elapsedMs: Date.now() - started, cause: error });
    }
    throw new SterlingTodayRequestError({ kind: "network", elapsedMs: Date.now() - started, cause: error });
  } finally { clearTimeout(timer); }
}

function structuredText(json: ResponsesBody): string {
  const chunks: string[] = [];
  for (const item of json.output ?? []) {
    if (item.status === "failed" || item.status === "incomplete") return "";
    for (const part of item.content ?? []) {
      if (part.type === "refusal") return "";
      if ((part.type === "output_text" || part.type === "text") && part.text?.trim()) chunks.push(part.text.trim());
    }
  }
  return chunks.join("\n").trim() || json.output_text?.trim() || "";
}

async function readResponsesBody(response: Response): Promise<ResponsesBody | null> {
  try { return await response.json() as ResponsesBody; } catch { return null; }
}

function responsesErrorDetails(error: ResponsesError | null | undefined): {
  code: string | null; apiType: string | null; param: string | null;
} {
  return {
    code: diagnosticToken(error?.code),
    apiType: diagnosticToken(error?.type),
    param: diagnosticToken(error?.param),
  };
}

function diagnosticToken(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return /^[a-zA-Z0-9_.[\]-]{1,160}$/.test(value) ? value : null;
}

function isPositiveFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
