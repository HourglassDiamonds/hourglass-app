/**
 * Public System Temperature bands.
 * ~50° ≈ normal operating conditions.
 */

import type { TemperatureBandDefinition, TemperatureBandId } from "./types";

export const TEMPERATURE_BANDS: readonly TemperatureBandDefinition[] = [
  {
    id: "abnormally-cool",
    min: 0,
    max: 24,
    label: "Abnormally Cool",
    summary:
      "Unusually loose conditions, unusually low systemic pressure, or atypically abundant flexibility.",
  },
  {
    id: "calm",
    min: 25,
    max: 44,
    label: "Calm",
    summary:
      "Pressure is below normal or easily absorbed. Major systems have ample operating flexibility.",
  },
  {
    id: "normal",
    min: 45,
    max: 54,
    label: "Normal",
    summary:
      "Normal operating range. Friction and risk exist, but systems broadly absorb them without unusual strain.",
  },
  {
    id: "elevated",
    min: 55,
    max: 64,
    label: "Elevated",
    summary:
      "Meaningful pressure is present across one or more channels, but broader systems remain functional and adaptive.",
  },
  {
    id: "high",
    min: 65,
    max: 74,
    label: "High",
    summary:
      "Persistent or multi-channel pressure is requiring meaningful adaptation, though systemic function remains intact.",
  },
  {
    id: "very-high",
    min: 75,
    max: 84,
    label: "Very High",
    summary:
      "Serious pressure is confirmed across multiple systems with meaningful downstream transmission.",
  },
  {
    id: "severe",
    min: 85,
    max: 94,
    label: "Severe",
    summary:
      "Broad systemic pressure or dysfunction is occurring across multiple major channels. Normal flexibility is materially impaired.",
  },
  {
    id: "critical",
    min: 95,
    max: 100,
    label: "Critical",
    summary:
      "Confirmed systemic dysfunction, failure, severe dislocation, or loss of normal operating function — not merely a dense bad-news cycle.",
  },
] as const;

export function bandForDegrees(degrees: number): TemperatureBandDefinition {
  const clamped = Math.min(100, Math.max(0, Math.round(degrees)));
  const match = TEMPERATURE_BANDS.find(
    (band) => clamped >= band.min && clamped <= band.max,
  );
  if (!match) {
    throw new Error(`No temperature band for ${clamped}°`);
  }
  return match;
}

export function bandIdForDegrees(degrees: number): TemperatureBandId {
  return bandForDegrees(degrees).id;
}
