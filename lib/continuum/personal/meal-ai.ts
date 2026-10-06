import "server-only";

import { getConciergeOpenAiApiKey } from "@/lib/continuum/concierge-sol/env";
import { CONCIERGE_SOL_RESPONSES_ENDPOINT, conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import type { MealEstimate, MealItem } from "./types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const mealSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "confidence", "clarification", "caveat"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "calories", "protein", "carbs", "fat", "confidence"],
        properties: {
          name: { type: "string" }, portion: { type: "string" },
          calories: { type: "number", minimum: 0, maximum: 4000 },
          protein: { type: "number", minimum: 0, maximum: 400 },
          carbs: { type: "number", minimum: 0, maximum: 600 },
          fat: { type: "number", minimum: 0, maximum: 400 },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    clarification: { anyOf: [{ type: "string" }, { type: "null" }] },
    caveat: { type: "string" },
  },
} as const;

function outputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) return [];
    return ((item as { content: unknown[] }).content).flatMap((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : []);
  }).join("\n");
}

function round(value: unknown): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.round(parsed));
}

export async function estimateMealPhoto(file: File): Promise<MealEstimate> {
  if (!IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("invalid-image");
  const apiKey = getConciergeOpenAiApiKey();
  if (!apiKey) throw new Error("meal-analysis-unavailable");
  const model = conciergeForegroundModel(process.env.CONTINUUM_CONCIERGE_MODEL);
  const image = Buffer.from(await file.arrayBuffer()).toString("base64");
  const response = await fetch(CONCIERGE_SOL_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Estimate the visible foods, practical household portions, and calories/macros. Be conservative about precision. If one clarification would materially change the estimate, ask exactly one short question. Do not claim certainty from a photo." },
          { type: "input_image", image_url: `data:${file.type};base64,${image}`, detail: "high" },
        ],
      }],
      text: { format: { type: "json_schema", name: "meal_photo_estimate", strict: true, schema: mealSchema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`meal-analysis-failed-${response.status}`);
  const raw = outputText(await response.json());
  const parsed = JSON.parse(raw) as { items?: unknown; confidence?: unknown; clarification?: unknown; caveat?: unknown };
  if (!Array.isArray(parsed.items) || !parsed.items.length) throw new Error("meal-analysis-invalid");
  const items: MealItem[] = parsed.items.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 100) : "";
    if (!name) return [];
    const confidence = row.confidence === "low" || row.confidence === "high" ? row.confidence : "medium";
    return [{ id: `estimate-item-${index}-${Date.now()}`, name, portion: typeof row.portion === "string" ? row.portion.trim().slice(0, 80) : "portion unclear", calories: round(row.calories), protein: round(row.protein), carbs: round(row.carbs), fat: round(row.fat), confidence }];
  });
  if (!items.length) throw new Error("meal-analysis-invalid");
  const total = (key: "calories" | "protein" | "carbs" | "fat") => items.reduce((sum, item) => sum + item[key], 0);
  return {
    id: `meal-estimate-${Date.now()}`,
    estimatedAt: new Date().toISOString(),
    items,
    calories: total("calories"), protein: total("protein"), carbs: total("carbs"), fat: total("fat"),
    confidence: parsed.confidence === "low" || parsed.confidence === "high" ? parsed.confidence : "medium",
    clarification: typeof parsed.clarification === "string" && parsed.clarification.trim()
      ? parsed.clarification.trim().slice(0, 240)
      : parsed.confidence === "low"
        ? "What is the main protein and roughly how much was served?"
        : undefined,
    caveat: typeof parsed.caveat === "string" && parsed.caveat.trim() ? parsed.caveat.trim().slice(0, 240) : "Photo-based nutrition is an estimate; review portions and macros before saving.",
    model,
  };
}
