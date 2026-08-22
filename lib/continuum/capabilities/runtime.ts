/**
 * Domain-neutral Capability executor.
 * Does not fetch sources or persist to production.
 */

import { randomUUID } from "node:crypto";
import { CONTINUUM_SCHEMA_VERSION } from "../contracts/types";
import type { ContinuumObservation } from "../contracts/types";
import {
  type Capability,
  type CapabilityResult,
  type ExecuteCapabilityInput,
  type JsonValue,
  type ObservationDraft,
} from "./types";
import {
  dedupeEvidenceRefs,
  validateCapabilityDefinition,
  validateCapabilityInvocation,
  validateObservationDraftShape,
} from "./validation";

function failedResult<V extends JsonValue>(
  capabilityVersion: string,
  failureCode: string,
  note: string,
): CapabilityResult<V> {
  return {
    status: "failed",
    observations: [],
    sourceHealth: [],
    failureCode,
    diagnostics: { capabilityVersion, notes: [note] },
  };
}

export async function executeCapability<I, V extends JsonValue>(
  input: ExecuteCapabilityInput<I, V>,
): Promise<CapabilityResult<V>> {
  const { capability, domainInput, context } = input;
  const definitionCheck = validateCapabilityDefinition(capability.definition);
  if (!definitionCheck.ok) {
    return failedResult(
      capability.definition.capabilityVersion,
      definitionCheck.failureCode,
      definitionCheck.reason,
    );
  }

  const invocationCheck = validateCapabilityInvocation(
    context.invocation,
    capability.definition.capabilityId,
  );
  if (!invocationCheck.ok) {
    return failedResult(
      capability.definition.capabilityVersion,
      invocationCheck.failureCode,
      invocationCheck.reason,
    );
  }

  let result: CapabilityResult<V>;
  try {
    result = await capability.run(domainInput, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected";
    context.log.warn("capability-unexpected", {
      capabilityId: capability.definition.capabilityId,
    });
    return failedResult(
      capability.definition.capabilityVersion,
      "unexpected",
      message.includes("@") ? "redacted" : message,
    );
  }

  const validated = await validateCapabilityResult(capability, result, input);
  if (validated.status === "failed" || validated.status === "blocked") {
    return { ...validated, observations: [] };
  }

  if (input.persist && validated.observations.length > 0) {
    await persistDrafts(validated, capability, context, input.persist);
  }

  return validated;
}

async function validateCapabilityResult<I, V extends JsonValue>(
  capability: Capability<I, V>,
  result: CapabilityResult<V>,
  input: ExecuteCapabilityInput<I, V>,
): Promise<CapabilityResult<V>> {
  const version = capability.definition.capabilityVersion;
  if (
    (result.status === "blocked" || result.status === "failed") &&
    result.observations.length > 0
  ) {
    return failedResult(version, "invalid-result", "blocked/failed must not emit observations");
  }
  if (!capability.definition.producesObservations && result.observations.length > 0) {
    return failedResult(
      version,
      "invalid-result",
      "capability does not produce observations",
    );
  }

  const normalized: ObservationDraft<V>[] = [];
  for (const draft of result.observations) {
    const shape = validateObservationDraftShape(
      draft,
      capability.definition.allowedObservationTypes,
    );
    if (!shape.ok) {
      return failedResult(version, shape.failureCode, shape.reason);
    }
    if (!capability.validateObservationValue(draft.observationType, draft.value)) {
      return failedResult(
        version,
        "invalid-observation-value",
        "capability rejected observation value",
      );
    }
    const uniqueRefs = dedupeEvidenceRefs(draft.evidenceRefs);
    if (uniqueRefs.length < 1) {
      return failedResult(version, "empty-evidence-refs", "no evidence refs");
    }
    if (!input.evidence) {
      return failedResult(
        version,
        "missing-evidence",
        "evidence lookup required to validate drafts",
      );
    }
    for (const id of uniqueRefs) {
      const evidence = await input.evidence.getById(id);
      if (!evidence) {
        return failedResult(version, "missing-evidence", "evidence id not found");
      }
      if (evidence.sourceKind === "observation") {
        return failedResult(
          version,
          "observation-kind-evidence",
          "observation-kind evidence is not allowed",
        );
      }
    }
    normalized.push({
      ...draft,
      evidenceRefs: uniqueRefs as [string, ...string[]],
    });
  }

  return { ...result, observations: normalized };
}

async function persistDrafts<V extends JsonValue>(
  result: CapabilityResult<V>,
  capability: { definition: { capabilityId: string; capabilityVersion: string } },
  context: ExecuteCapabilityInput<unknown, V>["context"],
  persist: NonNullable<ExecuteCapabilityInput<unknown, V>["persist"]>,
): Promise<void> {
  const createdAt = context.now().toISOString();
  const producedBy = `${capability.definition.capabilityId}@${capability.definition.capabilityVersion}`;
  for (const draft of result.observations) {
    const observation: ContinuumObservation = {
      id: randomUUID(),
      schemaVersion: CONTINUUM_SCHEMA_VERSION,
      observationType: draft.observationType,
      subjectEntityId: draft.subjectEntityId,
      statement: draft.statement,
      value: toObservationValue(draft.value),
      epistemicClass: draft.epistemicClass,
      confidence: draft.confidence,
      producedBy,
      createdAt,
      validFrom: draft.validFrom ?? context.invocation.asOf,
      validUntil: draft.validUntil ?? null,
      supersedesId: null,
      materiality: draft.materiality,
      urgency: draft.urgency,
    };
    await persist.insertObservation(observation);
    for (const evidenceId of draft.evidenceRefs) {
      await persist.linkObservationEvidence({
        observationId: observation.id,
        evidenceId,
      });
    }
  }
}

function toObservationValue(
  value: JsonValue,
): { readonly [key: string]: string | number | boolean | null } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const out: { [key: string]: string | number | boolean | null } = {};
  for (const [key, child] of Object.entries(value)) {
    if (
      child === null ||
      typeof child === "string" ||
      typeof child === "number" ||
      typeof child === "boolean"
    ) {
      out[key] = child;
    } else {
      return null;
    }
  }
  return out;
}
