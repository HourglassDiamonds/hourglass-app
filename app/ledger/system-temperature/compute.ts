/**
 * System Temperature calculation.
 * Editorial judgment assigns pressure/transmission; code computes degrees.
 * Transmission acts as a cap/dampener — not a second additive score.
 * Confidence never enters the degree math.
 */

import { bandForDegrees } from "./bands";
import {
  TEMPERATURE_CHANNEL_ORDER,
  TEMPERATURE_CHANNEL_WEIGHTS,
} from "./weights";
import type {
  ChannelAssessment,
  PressureLevel,
  SystemTemperatureReading,
  SystemTemperatureSnapshot,
  TransmissionLevel,
} from "./types";
import { validateTemperatureReading } from "./validate";

/** Fixed midpoints for discrete pressure levels — avoid free-form micro-scoring. */
export const PRESSURE_MIDPOINTS: Record<PressureLevel, number> = {
  "abnormally-cool": 12,
  calm: 35,
  normal: 50,
  elevated: 60,
  high: 70,
  "very-high": 80,
  severe: 90,
  critical: 97,
};

/**
 * Maximum contribution a channel may add given transmission.
 * Extreme external pressure without transmission cannot force critical heat.
 */
export const TRANSMISSION_CAPS: Record<TransmissionLevel, number> = {
  "not-transmitting": 54,
  contained: 64,
  partial: 74,
  broad: 84,
  "systemic-dysfunction": 100,
};

export function channelContribution(channel: ChannelAssessment): number {
  const raw = PRESSURE_MIDPOINTS[channel.pressure];
  const cap = TRANSMISSION_CAPS[channel.transmission];
  return Math.min(raw, cap);
}

export function computeWeightedTemperature(
  channels: readonly ChannelAssessment[],
  weights: Record<string, number> = TEMPERATURE_CHANNEL_WEIGHTS,
): number {
  let sum = 0;
  for (const id of TEMPERATURE_CHANNEL_ORDER) {
    const channel = channels.find((entry) => entry.id === id);
    if (!channel) {
      throw new Error(`Missing temperature channel: ${id}`);
    }
    sum += weights[id] * channelContribution(channel);
  }
  return sum;
}

export function computeTemperatureDegrees(
  snapshot: SystemTemperatureSnapshot,
): number {
  if (snapshot.editorialOverrideDegrees) {
    return Math.min(
      100,
      Math.max(0, Math.round(snapshot.editorialOverrideDegrees.degrees)),
    );
  }
  return Math.round(computeWeightedTemperature(snapshot.channels));
}

export type PublishTemperatureOptions = {
  previousDegrees?: number | null;
  /** When true, skip week-over-week delta rules (first v1 baseline). */
  isBaseline?: boolean;
};

export function publishTemperatureReading(
  snapshot: SystemTemperatureSnapshot,
  options: PublishTemperatureOptions = {},
): SystemTemperatureReading {
  const degrees = computeTemperatureDegrees(snapshot);
  const band = bandForDegrees(degrees);
  const previousDegrees =
    options.previousDegrees === undefined ? null : options.previousDegrees;
  const isBaseline =
    options.isBaseline === true ||
    snapshot.isBaselineReading === true ||
    previousDegrees === null;
  const weeklyDelta = isBaseline || previousDegrees === null
    ? null
    : degrees - previousDegrees;

  const validation = validateTemperatureReading({
    snapshot,
    degrees,
    previousDegrees,
    weeklyDelta,
    isBaseline,
  });

  return {
    degrees,
    band: band.id,
    bandLabel: band.label,
    weeklyDelta,
    previousDegrees,
    confidence: snapshot.confidence,
    pressureLabel: snapshot.pressureLabel,
    functioningLabel: snapshot.functioningLabel,
    explanation: snapshot.explanation,
    reviewDate: snapshot.reviewDate,
    evidenceCutoff: snapshot.evidenceCutoff,
    methodologyVersion: snapshot.methodologyVersion,
    baselineLabel: isBaseline
      ? `Baseline established ${snapshot.reviewDate}`
      : null,
    validation,
  };
}
