import "server-only";

import { randomUUID } from "node:crypto";
import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { CONCIERGE_SOL_RESPONSES_ENDPOINT, conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import { activityNutritionGuidance } from "./guidance";
import type { ActivityFacts, ActivityMetric, EvidenceKind, MealItem, NaturalIngestionProposal, PerformanceSourceType, PersonalState, ProposalConfidence } from "./types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ACTIVITY_FIELDS = ["durationMinutes", "distanceMiles", "pace", "averageSpeedMph", "averageHeartRate", "maxHeartRate", "elevationFeet", "reportedCalories", "whoopStrain", "steps", "ruckWeightLb"] as const;

const intakeSchema = {
  type: "object", additionalProperties: false,
  required: ["kind", "summary", "confidence", "assumptions", "meal", "activity"],
  properties: {
    kind: { type: "string", enum: ["meal", "activity"] }, summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    assumptions: { type: "array", maxItems: 12, items: { type: "string" } },
    meal: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["items", "clarification", "caveat"], properties: {
      items: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", additionalProperties: false, required: ["name", "portion", "calories", "protein", "carbs", "fat", "confidence"], properties: {
        name: { type: "string" }, portion: { type: "string" }, calories: { type: "number", minimum: 0, maximum: 5000 },
        protein: { type: "number", minimum: 0, maximum: 500 }, carbs: { type: "number", minimum: 0, maximum: 800 }, fat: { type: "number", minimum: 0, maximum: 500 },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
      } } }, clarification: { anyOf: [{ type: "string" }, { type: "null" }] }, caveat: { type: "string" },
    } }] },
    activity: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false,
      required: ["activityType", "durationMinutes", "distanceMiles", "pace", "averageSpeedMph", "averageHeartRate", "maxHeartRate", "elevationFeet", "reportedCalories", "whoopStrain", "steps", "ruckWeightLb", "notes", "observedFields"],
      properties: {
        activityType: { type: "string" }, durationMinutes: nullableNumber(), distanceMiles: nullableNumber(), pace: nullableString(), averageSpeedMph: nullableNumber(),
        averageHeartRate: nullableNumber(), maxHeartRate: nullableNumber(), elevationFeet: nullableNumber(), reportedCalories: nullableNumber(), whoopStrain: nullableNumber(),
        steps: nullableNumber(), ruckWeightLb: nullableNumber(), notes: nullableString(), observedFields: { type: "array", items: { type: "string", enum: [...ACTIVITY_FIELDS] } },
      },
    }] },
  },
} as const;

function nullableNumber() { return { anyOf: [{ type: "number" }, { type: "null" }] } as const; }
function nullableString() { return { anyOf: [{ type: "string" }, { type: "null" }] } as const; }

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

function round(value: unknown): number { return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0)); }
function metric<T extends number | string>(value: T | null, evidence: EvidenceKind): ActivityMetric<T> | undefined { return value === null || value === "" ? undefined : { value, evidence }; }

export async function interpretPerformanceIntake(input: {
  text?: string; file?: File; sourceType: PerformanceSourceType; knownMeals?: string[]; nutritionTargets: PersonalState["nutritionTargets"];
}): Promise<NaturalIngestionProposal> {
  const text = input.text?.trim().slice(0, 2_000) ?? "";
  if (!text && !input.file) throw new Error("intake-required");
  if (input.file && (!IMAGE_TYPES.has(input.file.type) || input.file.size <= 0 || input.file.size > MAX_IMAGE_BYTES)) throw new Error("invalid-image");
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) throw new Error("performance-analysis-unavailable");
  const model = conciergeForegroundModel(process.env.CONTINUUM_CONCIERGE_MODEL);
  const context = (input.knownMeals ?? []).slice(0, 12).join("; ");
  const instructions = [
    "Interpret this single Performance intake as either a meal/nutrition record or a completed activity.",
    "Use only visible or user-supplied facts. Never invent a missing metric or false precision.",
    "For nutrition labels, use visible label values and serving math. For meals, estimate practical portions/macros and state assumptions.",
    "For activity screenshots, extract visible duration, distance, pace/speed, heart rate, elevation, reported calories, WHOOP strain, steps, and ruck weight. Null absent values.",
    "observedFields must include only activity values directly visible in the image. Previously accepted meals are hints, not authority.",
    context ? `Accepted frequent-meal context: ${context}` : "No accepted frequent-meal context was supplied.",
    text ? `Founder description: ${text}` : "No accompanying description was supplied.",
  ].join("\n");
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: instructions }];
  if (input.file) content.push({ type: "input_image", image_url: `data:${input.file.type};base64,${Buffer.from(await input.file.arrayBuffer()).toString("base64")}`, detail: "high" });
  const response = await fetch(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false, input: [{ role: "user", content }], text: { format: { type: "json_schema", name: "performance_intake", strict: true, schema: intakeSchema } } }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`performance-analysis-failed-${response.status}`);
  const parsed = JSON.parse(outputText(await response.json())) as Record<string, unknown>;
  const confidence: ProposalConfidence = parsed.confidence === "low" || parsed.confidence === "high" ? parsed.confidence : "medium";
  const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 240)) : [];
  const base = { id: randomUUID(), proposedAt: new Date().toISOString(), sourceType: input.sourceType, rawInput: text || undefined, confidence, assumptions, summary: String(parsed.summary ?? "Review Sterling's interpretation.").slice(0, 500), model };
  if (parsed.kind === "meal" && parsed.meal && typeof parsed.meal === "object") {
    const rawMeal = parsed.meal as Record<string, unknown>;
    const items: MealItem[] = Array.isArray(rawMeal.items) ? rawMeal.items.flatMap((candidate, index) => {
      if (!candidate || typeof candidate !== "object") return [];
      const row = candidate as Record<string, unknown>; const name = String(row.name ?? "").trim().slice(0, 120); if (!name) return [];
      return [{ id: `proposal-item-${base.id}-${index}`, name, portion: String(row.portion ?? "portion unclear").slice(0, 120), calories: round(row.calories), protein: round(row.protein), carbs: round(row.carbs), fat: round(row.fat), confidence: row.confidence === "low" || row.confidence === "high" ? row.confidence : "medium" }];
    }) : [];
    if (!items.length) throw new Error("performance-analysis-invalid");
    const total = (key: "calories" | "protein" | "carbs" | "fat") => items.reduce((sum, item) => sum + item[key], 0);
    return { ...base, kind: "meal", meal: { id: base.id, estimatedAt: base.proposedAt, items, calories: total("calories"), protein: total("protein"), carbs: total("carbs"), fat: total("fat"), confidence, clarification: typeof rawMeal.clarification === "string" && rawMeal.clarification.trim() ? rawMeal.clarification.trim().slice(0, 240) : undefined, caveat: typeof rawMeal.caveat === "string" ? rawMeal.caveat.slice(0, 300) : "Review portions and macros before saving.", assumptions, model } };
  }
  if (parsed.kind !== "activity" || !parsed.activity || typeof parsed.activity !== "object") throw new Error("performance-analysis-invalid");
  const row = parsed.activity as Record<string, unknown>;
  const observed = new Set(Array.isArray(row.observedFields) ? row.observedFields.filter((value): value is string => typeof value === "string") : []);
  const evidenceFor = (field: string): EvidenceKind => input.file && observed.has(field) ? "observed" : text ? "user_supplied" : "estimated";
  const numeric = (field: string) => typeof row[field] === "number" && Number.isFinite(row[field]) ? metric(Math.max(0, row[field] as number), evidenceFor(field)) : undefined;
  const facts: ActivityFacts = { activityType: String(row.activityType ?? "Activity").trim().slice(0, 80) || "Activity", durationMinutes: numeric("durationMinutes"), distanceMiles: numeric("distanceMiles"), pace: typeof row.pace === "string" ? metric(row.pace.slice(0, 40), evidenceFor("pace")) : undefined, averageSpeedMph: numeric("averageSpeedMph"), averageHeartRate: numeric("averageHeartRate"), maxHeartRate: numeric("maxHeartRate"), elevationFeet: numeric("elevationFeet"), reportedCalories: numeric("reportedCalories"), whoopStrain: numeric("whoopStrain"), steps: numeric("steps"), ruckWeightLb: numeric("ruckWeightLb"), notes: typeof row.notes === "string" ? row.notes.slice(0, 500) : undefined };
  return { ...base, kind: "activity", activity: facts, guidance: activityNutritionGuidance(facts, input.nutritionTargets) };
}
