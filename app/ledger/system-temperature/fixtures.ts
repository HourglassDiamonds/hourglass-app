/**
 * Historical calibration fixtures for System Temperature backtesting.
 * These are methodological sanity checks — not false-precision reconstructions.
 */

import { computeWeightedTemperature, publishTemperatureReading } from "./compute";
import type { ChannelAssessment, SystemTemperatureSnapshot } from "./types";

const METHODOLOGY = "system-temperature-v1";

function cooling(partial?: Partial<SystemTemperatureSnapshot["coolingReview"]>) {
  return {
    improved: partial?.improved ?? "Fixture cooling note.",
    normalized: partial?.normalized ?? "Fixture normalization note.",
    failedToTransmit: partial?.failedToTransmit ?? "Fixture failed-transmission note.",
    absorbed: partial?.absorbed ?? "Fixture absorption note.",
    decayed: partial?.decayed ?? "Fixture decay note.",
  };
}

function channels(
  overrides: Partial<Record<ChannelAssessment["id"], Partial<ChannelAssessment>>>,
): ChannelAssessment[] {
  const base: ChannelAssessment[] = [
    {
      id: "geopolitics-energy-supply",
      pressure: "normal",
      transmission: "contained",
      transmissionExplanation: "Baseline fixture.",
      coolingNotes: "No acute escalation.",
    },
    {
      id: "financial-economic",
      pressure: "normal",
      transmission: "contained",
      transmissionExplanation: "Baseline fixture.",
      coolingNotes: "Credit functioning.",
    },
    {
      id: "physical-infrastructure",
      pressure: "normal",
      transmission: "contained",
      transmissionExplanation: "Baseline fixture.",
      coolingNotes: "Systems flexible.",
    },
    {
      id: "commodities-materials",
      pressure: "normal",
      transmission: "contained",
      transmissionExplanation: "Baseline fixture.",
      coolingNotes: "Materials balanced.",
    },
    {
      id: "technology-ai",
      pressure: "normal",
      transmission: "contained",
      transmissionExplanation: "Baseline fixture.",
      coolingNotes: "Deployment ordinary.",
    },
  ];

  return base.map((channel) => ({
    ...channel,
    ...overrides[channel.id],
    id: channel.id,
  }));
}

function fixtureSnapshot(
  partial: Omit<SystemTemperatureSnapshot, "methodologyVersion" | "evidenceCutoff" | "reviewDate" | "activeEvents" | "coolingReview" | "confidenceRationale"> &
    Partial<Pick<SystemTemperatureSnapshot, "coolingReview" | "confidenceRationale" | "activeEvents">>,
): SystemTemperatureSnapshot {
  return {
    reviewDate: "fixture",
    evidenceCutoff: "fixture",
    methodologyVersion: METHODOLOGY,
    activeEvents: partial.activeEvents ?? [],
    coolingReview: partial.coolingReview ?? cooling(),
    confidenceRationale:
      partial.confidenceRationale ?? "Fixture confidence rationale.",
    ...partial,
  };
}

/** Ordinary functioning ≈ 45–55° */
export const FIXTURE_ORDINARY_FUNCTIONING = fixtureSnapshot({
  channels: channels({}),
  confidence: "high",
  pressureLabel: "Normal Pressure",
  functioningLabel: "Systems Functioning",
  explanation: "Ordinary operating conditions with absorbed friction.",
});

/** Elevated external pressure, functioning markets ≈ 55–70° */
export const FIXTURE_ELEVATED_FUNCTIONING = fixtureSnapshot({
  channels: channels({
    "geopolitics-energy-supply": {
      pressure: "very-high",
      transmission: "contained",
      transmissionExplanation: "Elevated corridor risk without credit seizure.",
      coolingNotes: "Financial system offset remains.",
      materialChange: true,
    },
    "financial-economic": {
      pressure: "elevated",
      transmission: "contained",
    },
    "physical-infrastructure": {
      pressure: "elevated",
      transmission: "partial",
    },
    "commodities-materials": {
      pressure: "elevated",
      transmission: "contained",
    },
    "technology-ai": {
      pressure: "elevated",
      transmission: "partial",
    },
  }),
  confidence: "moderate",
  pressureLabel: "Elevated Pressure",
  functioningLabel: "Systems Functioning",
  explanation: "Meaningful external pressure with still-adaptive core systems.",
});

/** Multi-system stress with real transmission ≈ 70–85° */
export const FIXTURE_MULTI_SYSTEM_STRESS = fixtureSnapshot({
  channels: channels({
    "geopolitics-energy-supply": {
      pressure: "very-high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Energy premium and shipping disruption transmitting.",
      coolingNotes: "Still short of funding-market seizure.",
    },
    "financial-economic": {
      pressure: "high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Spreads and volatility confirming stress.",
      coolingNotes: "Not yet systemic dysfunction.",
    },
    "physical-infrastructure": {
      pressure: "high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Physical constraints binding across regions.",
      coolingNotes: "Systems still operating.",
    },
    "commodities-materials": {
      pressure: "high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Material prices and availability transmitting stress.",
      coolingNotes: "Still short of systemic materials failure.",
    },
    "technology-ai": {
      pressure: "high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Deployment and power constraints binding together.",
      coolingNotes: "Capability continues beneath strain.",
    },
  }),
  confidence: "moderate",
  pressureLabel: "Very High Pressure",
  functioningLabel: "Systems Strained",
  explanation: "Multiple channels show confirmed downstream transmission.",
});

/** March 2020-class acute systemic event → severe territory */
export const FIXTURE_MARCH_2020_CLASS = fixtureSnapshot({
  channels: channels({
    "geopolitics-energy-supply": {
      pressure: "severe",
      transmission: "broad",
      materialChange: true,
      transmissionExplanation: "Global synchronized disruption across borders.",
      coolingNotes: "Acute synchronized disruption.",
    },
    "financial-economic": {
      pressure: "critical",
      transmission: "systemic-dysfunction",
      materialChange: true,
      transmissionExplanation:
        "Extreme volatility, labor-market rupture, emergency monetary/fiscal intervention.",
      coolingNotes: "Acute crisis phase.",
    },
    "physical-infrastructure": {
      pressure: "severe",
      transmission: "broad",
      materialChange: true,
      transmissionExplanation: "Immediate real-economy stoppage.",
      coolingNotes: "Emergency conditions.",
    },
    "commodities-materials": {
      pressure: "severe",
      transmission: "broad",
      materialChange: true,
      transmissionExplanation: "Supply and demand rupture.",
      coolingNotes: "Crisis transmission.",
    },
    "technology-ai": {
      pressure: "high",
      transmission: "partial",
      materialChange: true,
      transmissionExplanation: "Operational disruption across firms and networks.",
      coolingNotes: "Secondary to broader shutdown.",
    },
  }),
  confidence: "moderate",
  pressureLabel: "Severe Pressure",
  functioningLabel: "Acute Systemic Disruption",
  explanation: "March 2020-class synchronized multi-system rupture.",
});

/** 2008-class systemic dysfunction → critical territory */
export const FIXTURE_CRISIS_2008_CLASS = fixtureSnapshot({
  channels: channels({
    "geopolitics-energy-supply": {
      pressure: "critical",
      transmission: "systemic-dysfunction",
      materialChange: true,
      transmissionExplanation:
        "Global confidence rupture accompanying financial-system failure.",
      coolingNotes: "Core failure remains financial.",
    },
    "financial-economic": {
      pressure: "critical",
      transmission: "systemic-dysfunction",
      materialChange: true,
      transmissionExplanation:
        "Institutional failures, frozen credit/funding markets, emergency rescues.",
      coolingNotes: "Systemic dysfunction confirmed.",
    },
    "physical-infrastructure": {
      pressure: "critical",
      transmission: "systemic-dysfunction",
      materialChange: true,
      transmissionExplanation: "Real-economy contraction following credit seizure.",
      coolingNotes: "Secondary to financial core.",
    },
    "commodities-materials": {
      pressure: "critical",
      transmission: "systemic-dysfunction",
      materialChange: true,
      transmissionExplanation: "Commodity and demand dislocation under credit seizure.",
      coolingNotes: "Crisis transmission.",
    },
    "technology-ai": {
      pressure: "severe",
      transmission: "broad",
      materialChange: true,
      transmissionExplanation: "Capex and enterprise disruption under funding stress.",
      coolingNotes: "Secondary channel.",
    },
  }),
  confidence: "high",
  pressureLabel: "Critical Pressure",
  functioningLabel: "Systemic Dysfunction",
  explanation: "2008-class credit seizure and institutional failure.",
});

/** Extreme geopolitics + contained transmission must not go critical */
export const FIXTURE_EXTREME_GEO_CONTAINED = fixtureSnapshot({
  channels: channels({
    "geopolitics-energy-supply": {
      pressure: "critical",
      transmission: "contained",
      materialChange: true,
      transmissionExplanation: "Extreme corridor threat without credit seizure.",
      coolingNotes: "Financial offset intact.",
    },
  }),
  confidence: "moderate",
  pressureLabel: "High External Pressure",
  functioningLabel: "Systems Functioning",
  explanation: "Dangerous geopolitics with contained broader transmission.",
});

export function evaluateFixture(snapshot: SystemTemperatureSnapshot) {
  const weighted = computeWeightedTemperature(snapshot.channels);
  const reading = publishTemperatureReading(snapshot, { isBaseline: true });
  return { weighted, reading };
}
