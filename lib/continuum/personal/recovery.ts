import type { RecoveryEntry } from "./types";

type ProposedRecovery = Omit<RecoveryEntry, "id" | "recordedAt">;

function hoursFromNarrative(text: string): number | undefined {
  const match = text.match(/(?:about\s+|around\s+|roughly\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const wordMatch = text.match(/(?:about\s+|around\s+|roughly\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?\b/i);
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const value = match ? Number(match[1]) : wordMatch ? words[wordMatch[1]!.toLowerCase()] : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 24 ? value : undefined;
}

export function proposeRecoveryFromNarrative(raw: string, date: string): ProposedRecovery {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const sleepHours = hoursFromNarrative(text);
  const highFatigue = /\b(gassed|wrecked|exhausted|spent|very tired|barely functioning)\b/.test(lower);
  const moderateFatigue = !highFatigue && /\b(tired|fatigued|dragging|low energy)\b/.test(lower);
  const noPain = /\b(no pain|pain[- ]?free|nothing hurts)\b/.test(lower);
  const pain = noPain ? "none" : /\b(severe pain|sharp pain)\b/.test(lower) ? "high" : /\b(pain|hurts|discomfort)\b/.test(lower) ? "moderate" : undefined;
  const noSoreness = /\b(not sore|no soreness)\b/.test(lower);
  const soreness = noSoreness ? "none" : /\b(very sore|really sore)\b/.test(lower) ? "high" : /\bsore(?:ness)?\b/.test(lower) ? "moderate" : undefined;

  return {
    date,
    ...(sleepHours !== undefined ? { sleepHours: { value: sleepHours, source: "manual" as const } } : {}),
    ...(highFatigue || moderateFatigue ? { fatigue: { value: highFatigue ? "high" as const : "moderate" as const, source: "subjective" as const } } : {}),
    ...(pain ? { pain: { value: pain, source: "subjective" as const } } : {}),
    ...(soreness ? { soreness: { value: soreness, source: "subjective" as const } } : {}),
    notes: text || undefined,
    rawNarrative: text || undefined,
    provenance: ["manual_recovery", "sterling"],
  };
}

export function hasRecoverySignal(entry: ProposedRecovery): boolean {
  return Boolean(entry.sleepHours || entry.sleepQuality || entry.recoveryScore || entry.strain || entry.restingHeartRate || entry.hrvMs || entry.bodyweightLb || entry.fatigue || entry.soreness || entry.pain);
}
