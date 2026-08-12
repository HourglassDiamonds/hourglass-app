/**
 * Ledger System Temperature — shared types.
 * Hub-only compression layer. Not derived by averaging public monitors.
 */

export type TemperatureChannelId =
  | "geopolitics-energy-supply"
  | "financial-economic"
  | "physical-infrastructure"
  | "commodities-materials"
  | "technology-ai";

export type PressureLevel =
  | "abnormally-cool"
  | "calm"
  | "normal"
  | "elevated"
  | "high"
  | "very-high"
  | "severe"
  | "critical";

export type TransmissionLevel =
  | "not-transmitting"
  | "contained"
  | "partial"
  | "broad"
  | "systemic-dysfunction";

export type ConfidenceLevel = "high" | "moderate" | "low";

export type TemperatureBandId =
  | "abnormally-cool"
  | "calm"
  | "normal"
  | "elevated"
  | "high"
  | "very-high"
  | "severe"
  | "critical";

export type ChannelAssessment = {
  id: TemperatureChannelId;
  pressure: PressureLevel;
  transmission: TransmissionLevel;
  /** Required when pressure or transmission rises vs prior published reading. */
  transmissionExplanation: string;
  /** Required every review — what cooled, failed to transmit, or should decay. */
  coolingNotes: string;
  evidenceRefs?: readonly string[];
  /** True when this channel saw a material condition change since last review. */
  materialChange?: boolean;
};

export type ActivePressureEvent = {
  id: string;
  label: string;
  firstIncorporatedReview: string;
  baselineIncorporated: true;
  lastMaterialChangeReview: string;
  decayEligible: boolean;
  notes: string;
};

export type CoolingReview = {
  improved: string;
  normalized: string;
  failedToTransmit: string;
  absorbed: string;
  decayed: string;
};

export type SystemTemperatureSnapshot = {
  reviewDate: string;
  evidenceCutoff: string;
  methodologyVersion: string;
  channels: readonly ChannelAssessment[];
  confidence: ConfidenceLevel;
  confidenceRationale: string;
  activeEvents: readonly ActivePressureEvent[];
  coolingReview: CoolingReview;
  pressureLabel: string;
  functioningLabel: string;
  explanation: string;
  /**
   * First official v1 reading has no comparable prior series.
   * Do not invent a delta against archived GPI / monitor scores.
   */
  isBaselineReading?: boolean;
  editorialOverrideDegrees?: {
    degrees: number;
    reason: string;
  };
};

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type SystemTemperatureReading = {
  degrees: number;
  band: TemperatureBandId;
  bandLabel: string;
  weeklyDelta: number | null;
  previousDegrees: number | null;
  confidence: ConfidenceLevel;
  pressureLabel: string;
  functioningLabel: string;
  explanation: string;
  reviewDate: string;
  evidenceCutoff: string;
  methodologyVersion: string;
  baselineLabel: string | null;
  validation: {
    ok: boolean;
    issues: readonly ValidationIssue[];
  };
};

export type TemperatureBandDefinition = {
  id: TemperatureBandId;
  min: number;
  max: number;
  label: string;
  summary: string;
};

export type HistoricalAnchor = {
  id: string;
  label: string;
  band: TemperatureBandId;
  approxRange: readonly [number, number];
  requiredCharacteristics: readonly string[];
  disqualifiers?: readonly string[];
};
