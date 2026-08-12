/**
 * Candidate System Temperature channel weights.
 * Backtested against historical fixtures before treating as permanent constants.
 */

import type { TemperatureChannelId } from "./types";

export const TEMPERATURE_CHANNEL_WEIGHTS: Record<TemperatureChannelId, number> =
  {
    "geopolitics-energy-supply": 0.3,
    "financial-economic": 0.25,
    "physical-infrastructure": 0.2,
    "commodities-materials": 0.15,
    "technology-ai": 0.1,
  };

export const TEMPERATURE_CHANNEL_ORDER: readonly TemperatureChannelId[] = [
  "geopolitics-energy-supply",
  "financial-economic",
  "physical-infrastructure",
  "commodities-materials",
  "technology-ai",
] as const;

export const TEMPERATURE_CHANNEL_LABELS: Record<TemperatureChannelId, string> =
  {
    "geopolitics-energy-supply": "Geopolitics / Energy / Supply Chains",
    "financial-economic": "Financial & Economic Transmission",
    "physical-infrastructure": "Physical Infrastructure",
    "commodities-materials": "Commodities / Materials",
    "technology-ai": "Technology / AI Deployment Pressure",
  };

export function assertWeightsSumToOne(
  weights: Record<TemperatureChannelId, number> = TEMPERATURE_CHANNEL_WEIGHTS,
): void {
  const sum = TEMPERATURE_CHANNEL_ORDER.reduce(
    (total, id) => total + weights[id],
    0,
  );
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Temperature weights must sum to 1 (got ${sum})`);
  }
}

assertWeightsSumToOne();
