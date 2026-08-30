/**
 * Bounded founder-reviewed artifact observation for Achedekal reconstruction.
 * Encoded observations only. Not a generic extraction pipeline.
 * Candidate-only. Does not write canonical records. Does not persist image
 * bytes. canonical: false.
 */

import {
  ACHEDEKAL_KNOWN_ARTIFACT_CAD,
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_PROJECT_ID,
} from "./achedekal-acceptance";
import { ALEA_KNOWN_THREAD_ID } from "./alea-known-thread-fixture";

export const ARTIFACT_EVIDENCE_STRENGTHS = [
  "explicit",
  "strong",
  "supporting",
  "unresolved",
] as const;

export type ArtifactEvidenceStrength =
  (typeof ARTIFACT_EVIDENCE_STRENGTHS)[number];

export const ARTIFACT_OBSERVATION_METHOD = "founder_reviewed_visual" as const;

export type ArtifactObservationMethod = typeof ARTIFACT_OBSERVATION_METHOD;

export const ARTIFACT_OBSERVATION_FIELDS = [
  "item_type",
  "cad_identifier",
  "finished_length",
  "extender_length",
  "stone_shape",
  "stone_size",
  "stone_quantity",
  "design_form",
  "cad_component_overall_length",
  "cad_component_body_detail",
  "cad_component_height",
  "cad_component_side_profile",
] as const;

export type ArtifactObservationField =
  (typeof ARTIFACT_OBSERVATION_FIELDS)[number];

export type ArtifactObservationCategory =
  | "item"
  | "identifier"
  | "length"
  | "stone"
  | "cad_component";

export type ArtifactObservationFact = {
  field: ArtifactObservationField;
  observedValue: string;
  source: "artifact";
  sourceArtifact: string;
  sourceThreadId: string;
  sourceProjectId: string;
  cadIdentifier: string;
  evidenceStrength: ArtifactEvidenceStrength;
  founderReviewed: true;
  canonical: false;
  category: ArtifactObservationCategory;
};

export type ArtifactObservation = {
  artifactFilename: string;
  sourceThreadId: string;
  sourceProjectId: string;
  cadIdentifier: string;
  observationMethod: ArtifactObservationMethod;
  founderReviewed: true;
  canonical: false;
  observations: readonly ArtifactObservationFact[];
};

const ARTIFACT_PROVENANCE = {
  source: "artifact" as const,
  sourceArtifact: ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  sourceThreadId: ALEA_KNOWN_THREAD_ID,
  sourceProjectId: ACHEDEKAL_PROJECT_ID,
  cadIdentifier: ACHEDEKAL_KNOWN_ARTIFACT_CAD,
  founderReviewed: true as const,
  canonical: false as const,
};

function observation(
  field: ArtifactObservationField,
  observedValue: string,
  evidenceStrength: ArtifactEvidenceStrength,
  category: ArtifactObservationCategory,
): ArtifactObservationFact {
  return {
    field,
    observedValue,
    evidenceStrength,
    category,
    ...ARTIFACT_PROVENANCE,
  };
}

/**
 * Founder-reviewed visual reading of H017-CBR2000037.jpg.
 * Encoded for this acceptance path. Does not fetch Gmail or inspect bytes.
 */
export function founderReviewedAchedekalArtifactObservation(): ArtifactObservation {
  return {
    artifactFilename: ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
    sourceThreadId: ALEA_KNOWN_THREAD_ID,
    sourceProjectId: ACHEDEKAL_PROJECT_ID,
    cadIdentifier: ACHEDEKAL_KNOWN_ARTIFACT_CAD,
    observationMethod: ARTIFACT_OBSERVATION_METHOD,
    founderReviewed: true,
    canonical: false,
    observations: [
      observation("item_type", "bracelet", "strong", "item"),
      observation(
        "cad_identifier",
        ACHEDEKAL_KNOWN_ARTIFACT_CAD,
        "explicit",
        "identifier",
      ),
      observation("finished_length", "6.5 in", "explicit", "length"),
      observation("extender_length", "1 in", "explicit", "length"),
      observation("stone_shape", "marquise / MQ", "explicit", "stone"),
      observation("stone_size", "4.00 × 2.00 mm", "explicit", "stone"),
      observation("stone_quantity", "5", "explicit", "stone"),
      observation(
        "design_form",
        "five spaced marquise-set stations on a fine chain bracelet",
        "strong",
        "item",
      ),
      observation(
        "cad_component_overall_length",
        "approx 8.0 mm",
        "supporting",
        "cad_component",
      ),
      observation(
        "cad_component_body_detail",
        "approx 5.2 mm",
        "supporting",
        "cad_component",
      ),
      observation(
        "cad_component_height",
        "approx 3.0 mm",
        "supporting",
        "cad_component",
      ),
      observation(
        "cad_component_side_profile",
        "approx 2.0 mm",
        "supporting",
        "cad_component",
      ),
    ],
  };
}

export function observationOf(
  observationSet: ArtifactObservation,
  field: ArtifactObservationField,
): ArtifactObservationFact | undefined {
  return observationSet.observations.find((row) => row.field === field);
}
