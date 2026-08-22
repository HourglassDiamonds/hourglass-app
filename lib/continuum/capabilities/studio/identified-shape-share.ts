/**
 * studio-identified-shape-share
 * Descriptive aggregation of identified Studio configurations in a window.
 * Does not infer trend, preference, or purchase intent.
 */

import { SHAPE_DISPLAY_LABELS, type ShapeId } from "@/lib/diamond-studio/configuration";
import { CAPABILITY_CONTRACT_VERSION, type Capability, type JsonValue } from "../types";
import type { CapabilityResult, ObservationDraft } from "../types";
import { isIsoTimestamp } from "../validation";
import {
  isShapeId,
  type StudioIdentifiedShapeShareInput,
  type StudioShapeFact,
} from "./read-model";

export const STUDIO_IDENTIFIED_SHAPE_SHARE_ID =
  "studio-identified-shape-share" as const;
export const STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE =
  "studio.identified_shape_share" as const;
export const STUDIO_IDENTIFIED_SHAPE_SHARE_VERSION = "1.0.0" as const;

export type StudioShapeShareValue = {
  shape: ShapeId;
  share: number;
  count: number;
  total: number;
  windowStart: string;
  windowEnd: string;
};

const VALUE_KEYS = [
  "shape",
  "share",
  "count",
  "total",
  "windowStart",
  "windowEnd",
] as const;

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

export function isStudioShapeShareValue(
  value: JsonValue,
): value is StudioShapeShareValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== VALUE_KEYS.length) return false;
  for (const key of VALUE_KEYS) {
    if (!keys.includes(key)) return false;
  }
  const record = value as {
    shape: unknown;
    share: unknown;
    count: unknown;
    total: unknown;
    windowStart: unknown;
    windowEnd: unknown;
  };
  if (typeof record.shape !== "string" || !isShapeId(record.shape)) return false;
  if (typeof record.share !== "number" || !Number.isFinite(record.share)) {
    return false;
  }
  if (record.share < 0 || record.share > 1) return false;
  if (typeof record.count !== "number" || !isInteger(record.count) || record.count < 1) {
    return false;
  }
  if (typeof record.total !== "number" || !isInteger(record.total) || record.total < record.count) {
    return false;
  }
  if (typeof record.windowStart !== "string" || !isIsoTimestamp(record.windowStart)) {
    return false;
  }
  if (typeof record.windowEnd !== "string" || !isIsoTimestamp(record.windowEnd)) {
    return false;
  }
  const expected = record.count / record.total;
  if (Math.abs(record.share - expected) > 1e-12) return false;
  return true;
}

function denominatorRefs(facts: readonly StudioShapeFact[]): [string, ...string[]] {
  const ids = [
    ...new Set(facts.map((fact) => fact.evidenceId)),
  ].sort((a, b) => a.localeCompare(b));
  if (ids.length === 0) {
    throw new Error("denominator requires evidence");
  }
  return ids as [string, ...string[]];
}

function statusFor(input: StudioIdentifiedShapeShareInput): CapabilityResult<StudioShapeShareValue>["status"] {
  const health = input.sourceHealth;
  if (
    health.required &&
    (health.availability === "unavailable" ||
      health.availability === "not-configured")
  ) {
    return "blocked";
  }
  if (health.availability === "empty" && health.quality === "healthy") {
    return "completed";
  }
  if (health.quality === "degraded" || health.freshness === "stale") {
    return "completed-degraded";
  }
  return "completed";
}

export const studioIdentifiedShapeShareCapability: Capability<
  StudioIdentifiedShapeShareInput,
  StudioShapeShareValue
> = {
  definition: {
    capabilityId: STUDIO_IDENTIFIED_SHAPE_SHARE_ID,
    contractVersion: CAPABILITY_CONTRACT_VERSION,
    capabilityVersion: STUDIO_IDENTIFIED_SHAPE_SHARE_VERSION,
    domain: "studio",
    requiredSources: ["continuum"],
    allowedObservationTypes: [STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE],
    reads: ["continuum.events", "continuum.evidence"],
    producesObservations: true,
  },

  validateObservationValue(observationType, value): value is StudioShapeShareValue {
    if (observationType !== STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE) {
      return false;
    }
    return isStudioShapeShareValue(value);
  },

  async run(input, _context) {
    const status = statusFor(input);
    const sourceHealth = [input.sourceHealth];
    const diagnostics = {
      capabilityVersion: STUDIO_IDENTIFIED_SHAPE_SHARE_VERSION,
      notes: [] as string[],
    };

    if (status === "blocked") {
      return {
        status,
        observations: [],
        sourceHealth,
        diagnostics,
      };
    }

    const total = input.facts.length;
    if (total === 0) {
      return {
        status,
        observations: [],
        sourceHealth,
        diagnostics,
      };
    }

    const counts = new Map<ShapeId, number>();
    for (const fact of input.facts) {
      counts.set(fact.shape, (counts.get(fact.shape) ?? 0) + 1);
    }
    const evidenceRefs = denominatorRefs(input.facts);
    const shapes = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    const observations: ObservationDraft<StudioShapeShareValue>[] = [];

    for (const shape of shapes) {
      const count = counts.get(shape) ?? 0;
      if (count < 1) continue;
      const share = count / total;
      const percent = Math.round(share * 100);
      const value: StudioShapeShareValue = {
        shape,
        share,
        count,
        total,
        windowStart: input.window.start,
        windowEnd: input.window.end,
      };
      observations.push({
        observationType: STUDIO_IDENTIFIED_SHAPE_SHARE_OBSERVATION_TYPE,
        subjectEntityId: null,
        statement: `${SHAPE_DISPLAY_LABELS[shape]} represented ${percent}% of identified Studio configurations during this window.`,
        value,
        epistemicClass: "derived",
        confidence: 1,
        evidenceRefs,
        validFrom: input.window.start,
        validUntil: input.window.end,
        materiality: "monitor",
        urgency: "low",
      });
    }

    return {
      status,
      observations,
      sourceHealth,
      diagnostics,
    };
  },
};
