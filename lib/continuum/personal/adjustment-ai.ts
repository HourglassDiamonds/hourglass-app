import "server-only";

import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { CONCIERGE_SOL_RESPONSES_ENDPOINT, conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import type { PersonalState, ProposalConfidence } from "./types";

const adjustmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "workoutId", "targetDate", "confidence", "warnings", "clarification"],
  properties: {
    status: { type: "string", enum: ["proposed", "clarification"] },
    summary: { type: "string" },
    workoutId: { anyOf: [{ type: "string" }, { type: "null" }] },
    targetDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    warnings: { type: "array", maxItems: 6, items: { type: "string" } },
    clarification: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} as const;

export type PerformanceAdjustmentInterpretation = {
  status: "proposed" | "clarification";
  summary: string;
  workoutId: string | null;
  targetDate: string | null;
  confidence: ProposalConfidence;
  warnings: string[];
  clarification: string | null;
};

function outputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => item && typeof item === "object" && Array.isArray((item as { content?: unknown }).content)
    ? (item as { content: unknown[] }).content.flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : [])
    : []).join("\n");
}

export async function interpretPerformanceAdjustment(input: {
  command: string;
  today: string;
  state: PersonalState;
}): Promise<PerformanceAdjustmentInterpretation> {
  const command = input.command.trim().slice(0, 2_000);
  if (!command) throw new Error("adjustment-required");
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) throw new Error("performance-analysis-unavailable");
  const schedule = input.state.schedule
    .filter((row) => row.status === "planned" || row.status === "unresolved")
    .slice(0, 21)
    .map((row) => ({ id: row.id, date: row.date, name: row.prescription.name, mode: row.prescription.mode, status: row.status }));
  const instructions = [
    "Interpret the founder's natural-language request as a proposed training-schedule adjustment.",
    "Return exactly one existing workoutId and one later YYYY-MM-DD targetDate only when the request clearly asks to move a planned workout.",
    "Golf or another real-life activity may explain the adjustment, but do not invent completion, duration, distance, calories, or other activity metrics.",
    "Do not modify progression, workout prescriptions, recovery history, or the program anchor. Do not claim anything was saved.",
    "If the intended workout or destination date is unclear, return status clarification with a concise question and null workoutId/targetDate.",
    `Today: ${input.today}`,
    `Eligible schedule: ${JSON.stringify(schedule)}`,
    `Founder request: ${command}`,
  ].join("\n");
  const response = await fetch(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: conciergeForegroundModel(process.env.CONTINUUM_CONCIERGE_MODEL),
      store: false,
      input: [{ role: "user", content: [{ type: "input_text", text: instructions }] }],
      text: { format: { type: "json_schema", name: "performance_adjustment", strict: true, schema: adjustmentSchema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`performance-adjustment-failed-${response.status}`);
  const raw = JSON.parse(outputText(await response.json())) as Record<string, unknown>;
  const status = raw.status === "proposed" ? "proposed" : "clarification";
  const confidence: ProposalConfidence = raw.confidence === "low" || raw.confidence === "high" ? raw.confidence : "medium";
  return {
    status,
    summary: String(raw.summary ?? "Review the proposed schedule change.").slice(0, 500),
    workoutId: typeof raw.workoutId === "string" ? raw.workoutId.slice(0, 200) : null,
    targetDate: typeof raw.targetDate === "string" ? raw.targetDate.slice(0, 10) : null,
    confidence,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 240)).slice(0, 6) : [],
    clarification: typeof raw.clarification === "string" ? raw.clarification.slice(0, 300) : null,
  };
}
