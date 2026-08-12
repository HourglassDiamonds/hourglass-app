/**
 * Anti-inflation validators for Ledger System Temperature.
 * Prefer fail/warn over silently clamping editorial intent.
 */

import { bandForDegrees, bandIdForDegrees } from "./bands";
import { channelContribution, PRESSURE_MIDPOINTS } from "./compute";
import { HISTORICAL_ANCHORS } from "./historical-anchors";
import { TEMPERATURE_CHANNEL_ORDER } from "./weights";
import type {
  ChannelAssessment,
  PressureLevel,
  SystemTemperatureSnapshot,
  TransmissionLevel,
  ValidationIssue,
} from "./types";

const PRESSURE_RANK: Record<PressureLevel, number> = {
  "abnormally-cool": 0,
  calm: 1,
  normal: 2,
  elevated: 3,
  high: 4,
  "very-high": 5,
  severe: 6,
  critical: 7,
};

const TRANSMISSION_RANK: Record<TransmissionLevel, number> = {
  "not-transmitting": 0,
  contained: 1,
  partial: 2,
  broad: 3,
  "systemic-dysfunction": 4,
};

export type ValidateArgs = {
  snapshot: SystemTemperatureSnapshot;
  degrees: number;
  previousDegrees: number | null;
  weeklyDelta: number | null;
  isBaseline: boolean;
  priorChannels?: readonly ChannelAssessment[] | null;
};

function hasBroadOrSystemicTransmission(
  channels: readonly ChannelAssessment[],
): boolean {
  return channels.some(
    (channel) =>
      channel.transmission === "broad" ||
      channel.transmission === "systemic-dysfunction",
  );
}

function hasSystemicDysfunction(
  channels: readonly ChannelAssessment[],
): boolean {
  return channels.some(
    (channel) => channel.transmission === "systemic-dysfunction",
  );
}

function hotChannelCount(channels: readonly ChannelAssessment[]): number {
  return channels.filter(
    (channel) => channelContribution(channel) >= PRESSURE_MIDPOINTS.high,
  ).length;
}

function coolingReviewComplete(
  snapshot: SystemTemperatureSnapshot,
): boolean {
  const { coolingReview } = snapshot;
  return Boolean(
    coolingReview.improved.trim() &&
      coolingReview.normalized.trim() &&
      coolingReview.failedToTransmit.trim() &&
      coolingReview.absorbed.trim() &&
      coolingReview.decayed.trim(),
  );
}

function channelRose(
  current: ChannelAssessment,
  prior: ChannelAssessment | undefined,
): boolean {
  if (!prior) return false;
  return (
    PRESSURE_RANK[current.pressure] > PRESSURE_RANK[prior.pressure] ||
    TRANSMISSION_RANK[current.transmission] >
      TRANSMISSION_RANK[prior.transmission]
  );
}

export function validateTemperatureReading(
  args: ValidateArgs,
): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const { snapshot, degrees, weeklyDelta, isBaseline, priorChannels } = args;
  const band = bandForDegrees(degrees);

  if (snapshot.channels.length !== TEMPERATURE_CHANNEL_ORDER.length) {
    issues.push({
      severity: "error",
      code: "channel-count",
      message: "All five temperature channels are required.",
    });
  }

  for (const id of TEMPERATURE_CHANNEL_ORDER) {
    if (!snapshot.channels.some((channel) => channel.id === id)) {
      issues.push({
        severity: "error",
        code: "missing-channel",
        message: `Missing channel assessment: ${id}`,
      });
    }
  }

  if (!coolingReviewComplete(snapshot)) {
    issues.push({
      severity: "error",
      code: "cooling-review-incomplete",
      message: "Mandatory cooling review fields must all be non-empty.",
    });
  }

  if (!snapshot.confidenceRationale.trim()) {
    issues.push({
      severity: "error",
      code: "confidence-rationale",
      message: "Confidence rationale is required (Information Signal layer).",
    });
  }

  if (degrees >= 90 && !hasBroadOrSystemicTransmission(snapshot.channels)) {
    issues.push({
      severity: "error",
      code: "ninety-plus-transmission",
      message:
        "A 90°+ reading requires broad or systemic transmission — geopolitical danger alone is insufficient.",
    });
  }

  if (degrees >= 95 && !hasSystemicDysfunction(snapshot.channels)) {
    issues.push({
      severity: "error",
      code: "ninety-five-plus-dysfunction",
      message:
        "A 95°+ reading requires confirmed systemic-dysfunction transmission.",
    });
  }

  if (
    (band.id === "severe" || band.id === "critical") &&
    hotChannelCount(snapshot.channels) < 2 &&
    !hasSystemicDysfunction(snapshot.channels)
  ) {
    issues.push({
      severity: "error",
      code: "band-corroboration",
      message:
        "Severe/critical bands generally require multi-channel heat or systemic-dysfunction transmission.",
    });
  }

  if (!isBaseline && weeklyDelta !== null) {
    const absDelta = Math.abs(weeklyDelta);
    if (weeklyDelta > 0) {
      const material = snapshot.channels.some((channel) => channel.materialChange);
      const explained = snapshot.channels.some(
        (channel) => channel.transmissionExplanation.trim().length > 0,
      );
      if (!material || !explained) {
        issues.push({
          severity: "error",
          code: "upward-move-explanation",
          message:
            "Any upward temperature move requires a material change flag and transmission explanation answering what changed in the actual system.",
        });
      }
    }

    if (absDelta >= 3 && absDelta <= 5) {
      const material = snapshot.channels.some((channel) => channel.materialChange);
      if (!material) {
        issues.push({
          severity: "error",
          code: "material-move-3-to-5",
          message: "A 3–5° move requires an explicit material channel change.",
        });
      }
    }

    if (absDelta > 5) {
      const materialCount = snapshot.channels.filter(
        (channel) => channel.materialChange,
      ).length;
      if (materialCount < 2 && !hasBroadOrSystemicTransmission(snapshot.channels)) {
        issues.push({
          severity: "error",
          code: "regime-move",
          message:
            "A move greater than 5° requires regime-level confirmation across multiple channels or broad/systemic transmission.",
        });
      }
    }
  }

  if (priorChannels) {
    for (const channel of snapshot.channels) {
      const prior = priorChannels.find((entry) => entry.id === channel.id);
      if (
        channelRose(channel, prior) &&
        !channel.materialChange &&
        !channel.transmissionExplanation.trim()
      ) {
        issues.push({
          severity: "error",
          code: "no-points-for-repetition",
          message: `Channel ${channel.id} rose without material change / explanation — unresolved baseline risk must not ratchet.`,
        });
      }
    }
  }

  // Historical sanity: readings in severe/critical must resemble crisis anchors.
  if (band.id === "critical") {
    const anchor = HISTORICAL_ANCHORS.find((item) => item.id === "crisis-2008-class");
    if (anchor && !hasSystemicDysfunction(snapshot.channels)) {
      issues.push({
        severity: "error",
        code: "historical-sanity-critical",
        message: `Critical readings must be comparable to ${anchor.label}.`,
      });
    }
  }

  if (band.id === "severe" && !hasBroadOrSystemicTransmission(snapshot.channels)) {
    issues.push({
      severity: "warning",
      code: "historical-sanity-severe",
      message:
        "Severe-band readings should show broad/systemic transmission comparable to acute multi-system stress episodes.",
    });
  }

  // Guard: extreme geopolitics alone with contained transmission should not be critical.
  const geo = snapshot.channels.find(
    (channel) => channel.id === "geopolitics-energy-supply",
  );
  if (
    geo &&
    PRESSURE_RANK[geo.pressure] >= PRESSURE_RANK.severe &&
    TRANSMISSION_RANK[geo.transmission] <= TRANSMISSION_RANK.contained &&
    degrees >= 85
  ) {
    issues.push({
      severity: "error",
      code: "geo-without-transmission",
      message:
        "Severe geopolitics with only contained transmission cannot produce an 85°+ system temperature.",
    });
  }

  if (snapshot.editorialOverrideDegrees) {
    issues.push({
      severity: "warning",
      code: "editorial-override",
      message: `Editorial override in use: ${snapshot.editorialOverrideDegrees.reason}`,
    });
  }

  // Soft check that published band label matches computed degrees.
  if (bandIdForDegrees(degrees) !== band.id) {
    issues.push({
      severity: "error",
      code: "band-mismatch",
      message: "Computed band does not match degrees.",
    });
  }

  const ok = !issues.some((issue) => issue.severity === "error");
  return { ok, issues };
}
