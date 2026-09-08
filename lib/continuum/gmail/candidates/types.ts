/**
 * Gmail evidence input for Candidate generation.
 * Uses indexed metadata plus optional in-memory exact-thread plaintext.
 * Does not fetch Gmail. Does not persist mailbox bodies.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { PersonRole } from "@/lib/continuum/client-memory/types";
import type { EditableProjectSpecField } from "@/lib/continuum/client-memory/project-spec/types";
import type { ProtectedExactThreadMessage } from "../exact-thread-payload";

export type GmailCandidatePerson = {
  personId: string;
  displayName: string;
  emailHash: string | null;
  role: PersonRole | null;
  projectIds: readonly string[];
};

export type GmailCandidateProject = {
  projectId: string;
  title: string;
  gmailThreadId: string | null;
  cadJobNumber: string | null;
  orderNumber: string | null;
  fingerSize: string | null;
  metal: string | null;
  centerStone: string | null;
  diamondSupplyNotes: string | null;
  personIds: readonly string[];
  founderApprovedCurrent: boolean;
};

export type GmailConfirmedPersonMapping = {
  emailHash: string;
  personId: string;
};

export type GmailConfirmedSourceLink = {
  threadId: string;
  personId: string;
};

export type GmailCandidateWorld = {
  people: readonly GmailCandidatePerson[];
  projects: readonly GmailCandidateProject[];
  internalEmailHashes: readonly string[];
  confirmedParticipantMappings?: readonly GmailConfirmedPersonMapping[];
  confirmedSourceLinks?: readonly GmailConfirmedSourceLink[];
  founderConfirmedEmailIdentities?: readonly GmailConfirmedPersonMapping[];
};

export type GmailCandidateEvidence = {
  indexed: GmailIndexedMessage;
  plaintext?: string | null;
  fromEmailHash?: string | null;
  attachments?: readonly {
    attachmentId: string;
    filename: string | null;
  }[];
};

export function evidenceFromIndexed(indexed: GmailIndexedMessage): GmailCandidateEvidence {
  return {
    indexed,
    plaintext: null,
    fromEmailHash: indexed.fromEmailHash,
    attachments: [],
  };
}

export function evidenceFromExactMessage(
  indexed: GmailIndexedMessage,
  message: ProtectedExactThreadMessage,
): GmailCandidateEvidence {
  return {
    indexed,
    plaintext: message.plainText,
    fromEmailHash: indexed.fromEmailHash,
    attachments: message.attachments.map((row) => ({
      attachmentId: row.attachmentId,
      filename: row.filename,
    })),
  };
}

export function specFieldValue(
  project: GmailCandidateProject,
  field: EditableProjectSpecField,
): string | null {
  switch (field) {
    case "finger_size":
      return project.fingerSize;
    case "order_number":
      return project.orderNumber;
    case "cad_job_number":
      return project.cadJobNumber;
    case "metal":
      return project.metal;
    case "center_stone":
      return project.centerStone;
    case "diamond_supply_notes":
      return project.diamondSupplyNotes;
  }
}
