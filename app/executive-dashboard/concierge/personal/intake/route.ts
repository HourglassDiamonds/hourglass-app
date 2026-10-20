import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { interpretPerformanceIntake } from "@/lib/continuum/personal/intake-ai";
import type { PerformanceSourceType, PersonalState } from "@/lib/continuum/personal/types";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const runtime = "nodejs";
const SOURCE_TYPES = new Set<PerformanceSourceType>(["text", "meal_photo", "nutrition_label", "activity_screenshot", "recovery_screenshot"]);

export async function POST(request: Request) {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  if (!session.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim().slice(0, 2_000);
    const fileValue = form.get("image"); const file = fileValue instanceof File && fileValue.size ? fileValue : undefined;
    const originalSourceDigestValue = String(form.get("originalSourceDigest") ?? "");
    const originalSourceDigest = /^[a-f0-9]{64}$/.test(originalSourceDigestValue) ? originalSourceDigestValue : undefined;
    const sourceTypeValue = String(form.get("sourceType") ?? (file ? "meal_photo" : "text"));
    if (!SOURCE_TYPES.has(sourceTypeValue as PerformanceSourceType)) return NextResponse.json({ ok: false, error: "invalid-source-type" }, { status: 400 });
    const knownMealsParsed: unknown = JSON.parse(String(form.get("knownMeals") ?? "[]"));
    const targetsParsed = JSON.parse(String(form.get("nutritionTargets") ?? "{}")) as Partial<PersonalState["nutritionTargets"]>;
    const nutritionTargets = { calories: Number(targetsParsed.calories) || 2400, protein: Number(targetsParsed.protein) || 190, carbs: Number(targetsParsed.carbs) || 240, fat: Number(targetsParsed.fat) || 80 };
    const intentValue = String(form.get("intent") ?? "completed_activity");
    if (!new Set(["completed_activity", "upcoming_tonal_session", "recovery"]).has(intentValue)) return NextResponse.json({ ok: false, error: "invalid-intent" }, { status: 400 });
    const proposal = await interpretPerformanceIntake({ text, file, originalSourceDigest, sourceType: sourceTypeValue as PerformanceSourceType, knownMeals: Array.isArray(knownMealsParsed) ? knownMealsParsed.filter((value): value is string => typeof value === "string").slice(0, 12) : [], nutritionTargets, intent: intentValue as "completed_activity" | "upcoming_tonal_session" | "recovery" });
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "performance-analysis-failed";
    const status = ["invalid-image", "intake-required"].includes(message) ? 400 : message === "performance-analysis-unavailable" ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
