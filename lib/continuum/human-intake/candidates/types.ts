/**
 * Human Intake evidence input for the shared Continuum Candidate contract.
 * Not a second Candidate model. Parser output is mapped in propose.ts.
 */

import type { CandidateConfidence } from "@/lib/continuum/candidates/types";
import type { OpenJobActor, OpenJobKind } from "@/lib/continuum/client-memory/project-jobs/types";
import type { EditableProjectSpecField } from "@/lib/continuum/client-memory/project-spec/types";
import type { RelationshipContextLayer } from "@/lib/continuum/client-memory/types";

export type HumanIntakePerson = {
  personId: string;
  displayName: string;
};

export type HumanIntakeProject = {
  projectId: string;
  title: string;
  cadJobNumber?: string | null;
  orderNumber?: string | null;
  fingerSize?: string | null;
  metal?: string | null;
  centerStone?: string | null;
  diamondSupplyNotes?: string | null;
  personIds?: readonly string[];
};

export type HumanIntakeWorld = {
  people: readonly HumanIntakePerson[];
  projects: readonly HumanIntakeProject[];
};

export type HumanIntakeEvidence = {
  sourceId: string;
  text: string;
  capturedAt?: string | null;
  confirmedPersonIds?: readonly string[];
  confirmedProjectIds?: readonly string[];
};

export type IntakeLocator = {
  start: number;
  end: number;
  quote: string;
};

export type IntakeParseHit =
  | {
      kind: "person_association";
      locator: IntakeLocator;
      displayName: string;
      personId: string | null;
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "project_association";
      locator: IntakeLocator;
      title: string;
      token: string | null;
      projectId: string | null;
      match: "exact" | "ambiguous";
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "structured_spec";
      locator: IntakeLocator;
      fieldName: Extract<
        EditableProjectSpecField,
        "finger_size" | "cad_job_number" | "order_number"
      >;
      proposedValue: string;
      projectId: string | null;
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "note";
      locator: IntakeLocator;
      text: string;
      contextLayer: RelationshipContextLayer | null;
      personId: string | null;
      projectId: string | null;
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "open_job";
      locator: IntakeLocator;
      jobKind: OpenJobKind;
      subject: string;
      detail: string | null;
      waitingOnActor: OpenJobActor;
      dueAt: string | null;
      personId: string | null;
      projectId: string | null;
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "date";
      locator: IntakeLocator;
      raw: string;
      isoDate: string | null;
      precision: "day" | "unresolved";
      role: "deadline" | "mentioned" | "relative";
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    }
  | {
      kind: "follow_up";
      locator: IntakeLocator;
      text: string;
      dueAt: string | null;
      personId: string | null;
      projectId: string | null;
      confidence: CandidateConfidence;
      ruleIds: readonly string[];
    };
