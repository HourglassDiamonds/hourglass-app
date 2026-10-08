import { CONCIERGE_SOL_RESPONSES_ENDPOINT } from "@/lib/continuum/concierge-sol/models";
import { parseSterlingTodayProposal, STERLING_TODAY_OUTPUT_SCHEMA } from "./schema";
import { STERLING_TODAY_PROPOSAL_VERSION, type SterlingTodayProposal, type SterlingTodayWorkingSet } from "./types";

export const STERLING_TODAY_PROMPT_VERSION = "sterling-today-reasoning-v1" as const;
export const STERLING_TODAY_TIMEOUT_MS = 45_000;

const INSTRUCTIONS = [
  "You are Sterling, the primary intelligence layer for Continuum Today.",
  "Reason directly from the complete bounded working set. Work chronologically and semantically.",
  "Newer material evidence supersedes older evidence. Founder directives supersede inference.",
  "Actual fulfillment closes prior promises. Production/order evidence supersedes design-stage assumptions.",
  "Separate project stage from individual obligations. A production project may still have a founder obligation.",
  "Never assume an external email contact is a client. Classify the relationship role from canonical evidence.",
  "Newsletter, editorial, footer, quoted history, shipping boilerplate, schema fragments, technician notices, generic please language, naked place-order language, and cold solicitations are not Today actions.",
  "If evidence is ambiguous, preserve current canonical state, record the ambiguity, and propose no mutation.",
  "Every conclusion must cite evidenceId values from the working set. Do not invent identifiers.",
  "Presentation recommendations and canonical mutations are separate. Mutations are proposals only and always require founder approval.",
  "Use the exact runId and evidenceSnapshotId supplied. Return only the strict structured object.",
].join(" ");

type ResponsesBody = { status?: string; error?: unknown; output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  output?: Array<{ type?: string; status?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };

export async function requestSterlingTodayProposal(input: {
  apiKey: string; model: string; workingSet: SterlingTodayWorkingSet; fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<{ proposal: SterlingTodayProposal; latencyMs: number; inputBytes: number; outputBytes: number;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } }> {
  const started = Date.now();
  const serialized = JSON.stringify(input.workingSet);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? STERLING_TODAY_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
      method: "POST", signal: controller.signal,
      headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: input.model, store: false, max_output_tokens: 12_000,
        instructions: `${INSTRUCTIONS} Contract: ${STERLING_TODAY_PROPOSAL_VERSION}.`, input: serialized,
        text: { format: { type: "json_schema", name: "sterling_today_proposal_v1", strict: true, schema: STERLING_TODAY_OUTPUT_SCHEMA } } }),
    });
    if (!response.ok) throw new Error(`sterling-today-unavailable:${response.status}`);
    const json = await response.json() as ResponsesBody;
    const text = structuredText(json);
    if (!text) throw new SyntaxError("sterling-today-malformed");
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new SyntaxError("sterling-today-malformed"); }
    const proposal = parseSterlingTodayProposal(raw);
    if (!proposal) throw new SyntaxError("sterling-today-invalid-contract");
    return { proposal, latencyMs: Date.now() - started, inputBytes: Buffer.byteLength(serialized), outputBytes: Buffer.byteLength(text),
      usage: { inputTokens: json.usage?.input_tokens ?? null, outputTokens: json.usage?.output_tokens ?? null,
        totalTokens: json.usage?.total_tokens ?? null } };
  } finally { clearTimeout(timer); }
}

function structuredText(json: ResponsesBody): string {
  if (json.error || json.status === "failed" || json.status === "incomplete") return "";
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
