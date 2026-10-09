import { CONCIERGE_SOL_RESPONSES_ENDPOINT } from "@/lib/continuum/concierge-sol/models";
import { createSterlingEvidenceHandleMap, resolveSterlingEvidenceHandles } from "./evidence-handles";
import { parseSterlingTodayProposal, STERLING_TODAY_OUTPUT_SCHEMA } from "./schema";
import { STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal, type SterlingTodayWorkingSet } from "./types";

export const STERLING_TODAY_PROMPT_VERSION = "sterling-today-reasoning-v5" as const;
export const STERLING_TODAY_TIMEOUT_MS = 180_000;
export const STERLING_TODAY_TIMEOUT_ENV = "CONTINUUM_STERLING_TODAY_TIMEOUT_MS" as const;
export const STERLING_TODAY_MAX_OUTPUT_TOKENS = 24_000;
export const STERLING_TODAY_REASONING_EFFORT = "medium" as const;

const INSTRUCTIONS = [
  "You are Sterling, the primary intelligence layer for Continuum Today.",
  "Reason directly from the complete bounded working set. Work chronologically and semantically.",
  "First reconcile the complete portfolio. Return exactly one portfolioAssessment for every workUnitId in workingSet.workUnits before choosing Today recommendations.",
  "For every work unit determine current overall stage, all open and completed or superseded obligations, each obligation's responsible party, current next-step owner, confidence, exact evidence, and ambiguities.",
  "Represent stage in two fields: canonicalLifecycleStage must be null or one of the schema-permitted canonical lifecycle values; operationalSubstage may describe evidence such as paid preproduction without inventing a canonical state.",
  "Keep the portfolio assessment comprehensive. A Today recommendation may omit fulfilled or superseded obligations, but it must retain every open or ambiguous obligation for that work unit.",
  "A canonical project and an evidence-backed provisional work unit are both assessable work. Canonical identity and workflow responsibility are separate questions.",
  "A missing canonical Person ID does not make responsibility unknown. Assign stage responsibility and next-step ownership from evidence when it supports a party; use unknown only when responsibility itself is genuinely ambiguous.",
  "The portfolio assessment is authoritative for canonical lifecycle stage, operational substage, stage responsible party, and next-step owner. A Today recommendation references its assessment by workUnitId and recommendationItemId and must not restate those fields.",
  "For every work unit not presented in Today, set an explicit suppressed or ambiguous disposition and explain the omissionReason. Never silently omit a work unit.",
  "Newer material evidence supersedes older evidence. Founder directives supersede inference.",
  "Actual fulfillment closes prior promises. Production/order evidence supersedes design-stage assumptions.",
  "Separate project stage from individual obligations. A production project may still have a founder obligation.",
  "The overall project-stage holder must not erase a separate individual obligation or change that obligation's responsible party.",
  "Never assume an external email contact is a client. Classify the relationship role from canonical evidence.",
  "Newsletter, editorial, footer, quoted history, shipping boilerplate, schema fragments, technician notices, generic please language, naked place-order language, and cold solicitations are not Today actions.",
  "If evidence is ambiguous, preserve current canonical state, record the ambiguity, and propose no mutation.",
  "An unavailable or disabled calendar means unknown calendar context, not confirmation that no events exist.",
  "Evidence-backed active work without a canonical project may receive a responsible-party and next-step classification with projectId null. Explain that it is provisional, cite exact evidence, and propose no canonical mutation for it.",
  "Every conclusion must cite exact request-local evidenceId handles such as E0001 from the working set. Never cite sourceRef, messageId, threadId, or any invented identifier as evidenceRefs.",
  "Presentation recommendations and canonical mutations are separate. Mutations are proposals only and always require founder approval.",
  "Use the exact runId and evidenceSnapshotId supplied. Return only the strict structured object.",
].join(" ");

type ResponsesError = { code?: unknown; message?: unknown; param?: unknown; type?: unknown };
type ResponsesBody = { status?: string; error?: ResponsesError | null; output_text?: string;
  incomplete_details?: { reason?: unknown } | null;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number } };
  output?: Array<{ type?: string; status?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };

export class SterlingTodayRequestError extends Error {
  readonly kind: "timeout" | "api" | "network" | "response";
  readonly status: number | null;
  readonly code: string | null;
  readonly apiType: string | null;
  readonly param: string | null;
  readonly requestId: string | null;
  readonly elapsedMs: number;
  readonly incompleteReason: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly totalTokens: number | null;
  readonly maxOutputTokens: number | null;

  constructor(input: {
    kind: SterlingTodayRequestError["kind"];
    elapsedMs: number;
    status?: number | null;
    code?: string | null;
    apiType?: string | null;
    param?: string | null;
    requestId?: string | null;
    incompleteReason?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    reasoningTokens?: number | null;
    totalTokens?: number | null;
    maxOutputTokens?: number | null;
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
      input.incompleteReason ? `incompleteReason=${input.incompleteReason}` : null,
      input.inputTokens == null ? null : `inputTokens=${input.inputTokens}`,
      input.outputTokens == null ? null : `outputTokens=${input.outputTokens}`,
      input.reasoningTokens == null ? null : `reasoningTokens=${input.reasoningTokens}`,
      input.totalTokens == null ? null : `totalTokens=${input.totalTokens}`,
      input.maxOutputTokens == null ? null : `maxOutputTokens=${input.maxOutputTokens}`,
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
    this.incompleteReason = input.incompleteReason ?? null;
    this.inputTokens = input.inputTokens ?? null;
    this.outputTokens = input.outputTokens ?? null;
    this.reasoningTokens = input.reasoningTokens ?? null;
    this.totalTokens = input.totalTokens ?? null;
    this.maxOutputTokens = input.maxOutputTokens ?? null;
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
  usage: { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null } }> {
  const started = Date.now();
  const evidenceHandles = createSterlingEvidenceHandleMap(input.workingSet);
  const serialized = JSON.stringify(evidenceHandles.requestWorkingSet);
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
      body: JSON.stringify({ model: input.model, store: false, max_output_tokens: STERLING_TODAY_MAX_OUTPUT_TOKENS,
        reasoning: { effort: STERLING_TODAY_REASONING_EFFORT },
        instructions: `${INSTRUCTIONS} Contract: ${STERLING_TODAY_PROPOSAL_VERSION}.`, input: serialized,
        text: { format: { type: "json_schema", name: "sterling_today_proposal_v4", strict: true, schema: STERLING_TODAY_OUTPUT_SCHEMA } } }),
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
      const usage = responsesUsage(json.usage);
      throw new SterlingTodayRequestError({ kind: "response", status: response.status, requestId,
        elapsedMs: Date.now() - started, code: details.code ?? json.status ?? null,
        apiType: details.apiType, param: details.param,
        incompleteReason: diagnosticToken(json.incomplete_details?.reason),
        maxOutputTokens: STERLING_TODAY_MAX_OUTPUT_TOKENS, ...usage });
    }
    const text = structuredText(json);
    if (!text) throw new SyntaxError("sterling-today-malformed");
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new SyntaxError("sterling-today-malformed"); }
    const requestProposal = parseSterlingTodayProposal(raw);
    if (!requestProposal) throw new SyntaxError("sterling-today-invalid-contract");
    const proposal = resolveSterlingEvidenceHandles(requestProposal, evidenceHandles.handleToEvidenceId);
    return { proposal, latencyMs: Date.now() - started, inputBytes: Buffer.byteLength(serialized), outputBytes: Buffer.byteLength(text),
      usage: { inputTokens: json.usage?.input_tokens ?? null, outputTokens: json.usage?.output_tokens ?? null,
        reasoningTokens: json.usage?.output_tokens_details?.reasoning_tokens ?? null,
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

function responsesUsage(usage: ResponsesBody["usage"]): {
  inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null;
} {
  return {
    inputTokens: diagnosticInteger(usage?.input_tokens),
    outputTokens: diagnosticInteger(usage?.output_tokens),
    reasoningTokens: diagnosticInteger(usage?.output_tokens_details?.reasoning_tokens),
    totalTokens: diagnosticInteger(usage?.total_tokens),
  };
}

function diagnosticToken(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return /^[a-zA-Z0-9_.[\]-]{1,160}$/.test(value) ? value : null;
}

function diagnosticInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isPositiveFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
