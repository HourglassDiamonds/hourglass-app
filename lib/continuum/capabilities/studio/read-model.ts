/**
 * Domain input preparation for identified Studio shape-share.
 * Not imported by the generic Capability runtime.
 */

import type { ShapeId } from "@/lib/diamond-studio/configuration";
import { SHAPE_DISPLAY_LABELS } from "@/lib/diamond-studio/configuration";
import type { ContinuumEvent, ContinuumEvidence, ContinuumId } from "../../contracts/types";
import type { FreshnessStatus } from "../../contracts/types";
import type {
  CapabilitySourceHealth,
  CapabilityTimeWindow,
} from "../types";

export type StudioShapeFact = {
  occurredAt: string;
  shape: ShapeId;
  evidenceId: ContinuumId;
};

export type StudioIdentifiedShapeShareInput = {
  facts: StudioShapeFact[];
  window: CapabilityTimeWindow;
  sourceHealth: CapabilitySourceHealth;
};

export type StudioReadModelSource =
  | { kind: "not-configured" }
  | { kind: "unavailable" }
  | {
      kind: "snapshot";
      events: readonly ContinuumEvent[];
      evidence: readonly ContinuumEvidence[];
      freshness?: FreshnessStatus;
    };

const SOURCE_ID = "continuum";

export function isShapeId(value: string): value is ShapeId {
  return Object.prototype.hasOwnProperty.call(SHAPE_DISPLAY_LABELS, value);
}

function inWindow(
  occurredAt: string,
  window: CapabilityTimeWindow,
  asOf: string,
): boolean {
  const t = Date.parse(occurredAt);
  if (!Number.isFinite(t)) return false;
  return (
    t >= Date.parse(window.start) &&
    t <= Date.parse(window.end) &&
    t <= Date.parse(asOf)
  );
}

export function prepareStudioIdentifiedShapeShareInput(input: {
  source: StudioReadModelSource;
  window: CapabilityTimeWindow;
  asOf: string;
}): StudioIdentifiedShapeShareInput {
  if (input.source.kind === "not-configured") {
    return {
      facts: [],
      window: input.window,
      sourceHealth: {
        sourceId: SOURCE_ID,
        required: true,
        availability: "not-configured",
        quality: "unknown",
        freshness: "unavailable",
        note: "Continuum reader is not configured",
      },
    };
  }
  if (input.source.kind === "unavailable") {
    return {
      facts: [],
      window: input.window,
      sourceHealth: {
        sourceId: SOURCE_ID,
        required: true,
        availability: "unavailable",
        quality: "unknown",
        freshness: "unknown",
        note: "Continuum could not be read",
      },
    };
  }

  const freshness = input.source.freshness ?? "fresh";
  const evidenceByRecord = new Map<string, ContinuumEvidence[]>();
  for (const row of input.source.evidence) {
    if (
      row.sourceKind !== "source-record" ||
      row.sourceSystem !== "studio-identified" ||
      !row.sourceRecordId
    ) {
      continue;
    }
    const list = evidenceByRecord.get(row.sourceRecordId) ?? [];
    list.push(row);
    evidenceByRecord.set(row.sourceRecordId, list);
  }

  const candidates: ContinuumEvent[] = [];
  for (const event of input.source.events) {
    if (event.eventType !== "studio.view_emailed") continue;
    if (!inWindow(event.occurredAt, input.window, input.asOf)) continue;
    candidates.push(event);
  }

  if (candidates.length === 0) {
    return {
      facts: [],
      window: input.window,
      sourceHealth: {
        sourceId: SOURCE_ID,
        required: true,
        availability: "empty",
        quality: "healthy",
        freshness,
        note: "No identified Studio events in window",
      },
    };
  }

  const facts: StudioShapeFact[] = [];
  let skipped = 0;
  for (const event of candidates) {
    const matches = evidenceByRecord.get(event.sourceRecordId) ?? [];
    if (matches.length === 0) {
      skipped += 1;
      continue;
    }
    const shape = event.payload.configuration.shape;
    if (!isShapeId(shape)) {
      skipped += 1;
      continue;
    }
    const evidence = [...matches].sort((a, b) => a.id.localeCompare(b.id))[0];
    facts.push({
      occurredAt: event.occurredAt,
      shape,
      evidenceId: evidence.id,
    });
  }

  facts.sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.evidenceId.localeCompare(b.evidenceId),
  );

  const degraded = skipped > 0;
  return {
    facts,
    window: input.window,
    sourceHealth: {
      sourceId: SOURCE_ID,
      required: true,
      availability: "available",
      quality: degraded ? "degraded" : "healthy",
      freshness,
      note: degraded
        ? "Some candidate events lacked matching Evidence or a valid shape"
        : "Identified Studio events loaded",
    },
  };
}
