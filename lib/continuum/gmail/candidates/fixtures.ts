/**
 * Synthetic eight-project Gmail evidence for read-only candidate dry-run.
 * Does not load production. Does not mutate Projects.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type {
  GmailCandidateEvidence,
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./types";

const NOW_INDEXED = "2026-09-06T12:00:00.000Z";

function person(input: {
  personId: string;
  displayName: string;
  email: string;
  role: GmailCandidatePerson["role"];
  projectIds: readonly string[];
}): GmailCandidatePerson {
  return {
    personId: input.personId,
    displayName: input.displayName,
    emailHash: hashEmail(input.email),
    role: input.role,
    projectIds: input.projectIds,
  };
}

function project(input: {
  projectId: string;
  title: string;
  thread: string;
  cad?: string | null;
  order?: string | null;
  fingerSize?: string | null;
  metal?: string | null;
  centerStone?: string | null;
  supply?: string | null;
  personIds: readonly string[];
}): GmailCandidateProject {
  return {
    projectId: input.projectId,
    title: input.title,
    gmailThreadId: input.thread,
    cadJobNumber: input.cad ?? null,
    orderNumber: input.order ?? null,
    fingerSize: input.fingerSize ?? null,
    metal: input.metal ?? null,
    centerStone: input.centerStone ?? null,
    diamondSupplyNotes: input.supply ?? null,
    personIds: input.personIds,
    founderApprovedCurrent: true,
  };
}

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string | null;
  fromEmail?: string | null;
  direction: GmailIndexedMessage["direction"];
  hasAttachments?: boolean;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW_INDEXED,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction,
    labelIds: [],
    hasAttachments: Boolean(input.hasAttachments),
    sourceSystem: "gmail",
  };
}

export const EIGHT_PROJECT_IDS = {
  pennock: "11111111-1111-4111-8111-111111111111",
  leeSpiegel: "22222222-2222-4222-8222-222222222222",
  travis: "33333333-3333-4333-8333-333333333333",
  sarah: "44444444-4444-4444-8444-444444444444",
  dylan: "55555555-5555-4555-8555-555555555555",
  chelsea: "66666666-6666-4666-8666-666666666666",
  madi: "77777777-7777-4777-8777-777777777777",
  kaitlin: "88888888-8888-4888-8888-888888888888",
} as const;

export const EIGHT_THREADS = {
  pennock: "aaaaaaaaaa",
  leeSpiegel: "bbbbbbbbbb",
  travis: "cccccccccc",
  sarah: "dddddddddd",
  dylan: "eeeeeeeeee",
  chelsea: "ffffffffff",
  madi: "a1a1a1a1a1",
  kaitlin: "b2b2b2b2b2",
} as const;

export const EIGHT_EMAILS = {
  pennock: "pennock.client@example.test",
  lee: "lee.spiegel@example.test",
  travis: "travis.client@example.test",
  travisVendor: "travis.vendor@example.test",
  sarah: "sarah.client@example.test",
  dylan: "dylan.client@example.test",
  chelsea: "chelsea.client@example.test",
  madi: "madi.client@example.test",
  kaitlin: "kaitlin.client@example.test",
  founder: "founder@hourglass.example",
} as const;

export function eightProjectWorld(): GmailCandidateWorld {
  const people: GmailCandidatePerson[] = [
    person({
      personId: "person-pennock",
      displayName: "Pennock",
      email: EIGHT_EMAILS.pennock,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.pennock],
    }),
    person({
      personId: "person-lee",
      displayName: "Lee Spiegel",
      email: EIGHT_EMAILS.lee,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.leeSpiegel],
    }),
    person({
      personId: "person-travis",
      displayName: "Travis",
      email: EIGHT_EMAILS.travis,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.travis],
    }),
    person({
      personId: "person-travis-vendor",
      displayName: "Travis vendor",
      email: EIGHT_EMAILS.travisVendor,
      role: "vendor-contact",
      projectIds: [EIGHT_PROJECT_IDS.travis],
    }),
    person({
      personId: "person-sarah",
      displayName: "Sarah",
      email: EIGHT_EMAILS.sarah,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.sarah],
    }),
    person({
      personId: "person-dylan",
      displayName: "Dylan",
      email: EIGHT_EMAILS.dylan,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.dylan],
    }),
    person({
      personId: "person-chelsea",
      displayName: "Chelsea",
      email: EIGHT_EMAILS.chelsea,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.chelsea],
    }),
    person({
      personId: "person-madi",
      displayName: "Madi",
      email: EIGHT_EMAILS.madi,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.madi],
    }),
    person({
      personId: "person-kaitlin",
      displayName: "Kaitlin",
      email: EIGHT_EMAILS.kaitlin,
      role: "client",
      projectIds: [EIGHT_PROJECT_IDS.kaitlin],
    }),
  ];
  const projects: GmailCandidateProject[] = [
    project({
      projectId: EIGHT_PROJECT_IDS.pennock,
      title: "J.Pennock",
      thread: EIGHT_THREADS.pennock,
      metal: "18k white gold",
      supply: "customer natural sapphire",
      personIds: ["person-pennock"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.leeSpiegel,
      title: "Lee / Spiegel",
      thread: EIGHT_THREADS.leeSpiegel,
      personIds: ["person-lee"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.travis,
      title: "Travis",
      thread: EIGHT_THREADS.travis,
      fingerSize: "11",
      personIds: ["person-travis", "person-travis-vendor"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.sarah,
      title: "Sarah",
      thread: EIGHT_THREADS.sarah,
      personIds: ["person-sarah"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.dylan,
      title: "Dylan",
      thread: EIGHT_THREADS.dylan,
      personIds: ["person-dylan"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.chelsea,
      title: "Chelsea",
      thread: EIGHT_THREADS.chelsea,
      cad: "CR5001024",
      personIds: ["person-chelsea"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.madi,
      title: "Madi",
      thread: EIGHT_THREADS.madi,
      cad: "C017756",
      personIds: ["person-madi"],
    }),
    project({
      projectId: EIGHT_PROJECT_IDS.kaitlin,
      title: "Kaitlin",
      thread: EIGHT_THREADS.kaitlin,
      cad: "C017755",
      personIds: ["person-kaitlin"],
    }),
  ];
  return {
    people,
    projects,
    internalEmailHashes: [hashEmail(EIGHT_EMAILS.founder)!],
  };
}

export function evidenceOf(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string | null;
  fromEmail?: string | null;
  direction: GmailIndexedMessage["direction"];
  plaintext?: string | null;
  filenames?: readonly string[];
}): GmailCandidateEvidence {
  return {
    indexed: indexed({
      messageId: input.messageId,
      threadId: input.threadId,
      sentAt: input.sentAt,
      subject: input.subject,
      fromEmail: input.fromEmail,
      direction: input.direction,
      hasAttachments: Boolean(input.filenames?.length),
    }),
    plaintext: input.plaintext ?? null,
    fromEmailHash: hashEmail(input.fromEmail),
    attachments: (input.filenames ?? []).map((filename, index) => ({
      attachmentId: `att-${index + 1}`,
      filename,
    })),
  };
}

export function eightProjectEvidence(): GmailCandidateEvidence[] {
  return [
    evidenceOf({
      messageId: "msg-pennock-platinum",
      threadId: EIGHT_THREADS.pennock,
      sentAt: "2026-08-20T15:00:00.000Z",
      fromEmail: EIGHT_EMAILS.pennock,
      direction: "inbound",
      subject: "Pennock metal update",
      plaintext:
        "Newer direction: platinum, not white gold. Family synthetic sapphire for the center.",
    }),
    evidenceOf({
      messageId: "msg-lee-refinement",
      threadId: EIGHT_THREADS.leeSpiegel,
      sentAt: "2026-08-21T16:00:00.000Z",
      fromEmail: EIGHT_EMAILS.lee,
      direction: "inbound",
      subject: "CAD / design refinement",
      plaintext:
        "Current CAD design refinement. Client approval on the latest. Durability discussion still open. Can you send another render?",
    }),
    evidenceOf({
      messageId: "msg-travis-size",
      threadId: EIGHT_THREADS.travis,
      sentAt: "2026-08-22T17:00:00.000Z",
      fromEmail: EIGHT_EMAILS.travis,
      direction: "inbound",
      subject: "Size correction",
      plaintext: "Confirming finger size is 12.5.",
    }),
    evidenceOf({
      messageId: "msg-travis-vendor",
      threadId: EIGHT_THREADS.travis,
      sentAt: "2026-08-23T18:00:00.000Z",
      fromEmail: EIGHT_EMAILS.travisVendor,
      direction: "inbound",
      subject: "Production ETA",
      plaintext: "We'll send the revised CAD when ready. Production ETA next week.",
    }),
    evidenceOf({
      messageId: "msg-sarah",
      threadId: EIGHT_THREADS.sarah,
      sentAt: "2026-08-24T19:00:00.000Z",
      fromEmail: EIGHT_EMAILS.sarah,
      direction: "inbound",
      subject: "CAD revision D",
      plaintext:
        "CAD revision D. Finger size is 8.5. Customer center, vendor melee.",
    }),
    evidenceOf({
      messageId: "msg-dylan",
      threadId: EIGHT_THREADS.dylan,
      sentAt: "2026-08-25T20:00:00.000Z",
      fromEmail: EIGHT_EMAILS.dylan,
      direction: "inbound",
      subject: "Looks good",
      plaintext: "CAD looks great. Diamond looks awesome.",
    }),
    evidenceOf({
      messageId: "msg-chelsea-cad",
      threadId: EIGHT_THREADS.chelsea,
      sentAt: "2026-08-26T21:00:00.000Z",
      fromEmail: EIGHT_EMAILS.chelsea,
      direction: "inbound",
      subject: "CR5001024",
      plaintext: "Current CAD is CR5001024.",
    }),
    evidenceOf({
      messageId: "msg-madi-cad",
      threadId: EIGHT_THREADS.madi,
      sentAt: "2026-08-27T22:00:00.000Z",
      fromEmail: EIGHT_EMAILS.madi,
      direction: "inbound",
      subject: "Wedding band CAD",
      plaintext: "Current wedding-band CAD C017756.",
    }),
    evidenceOf({
      messageId: "msg-kaitlin-cad",
      threadId: EIGHT_THREADS.kaitlin,
      sentAt: "2026-08-28T23:00:00.000Z",
      fromEmail: EIGHT_EMAILS.kaitlin,
      direction: "inbound",
      subject: "Wedding band CAD",
      plaintext: "Current wedding-band CAD C017755.",
    }),
  ];
}

export const EIGHT_PROJECT_WORLD = eightProjectWorld();
export const EIGHT_PROJECT_EVIDENCE = eightProjectEvidence();
export const EIGHT_PROJECT_DRY_RUN_CREATED_AT = NOW_INDEXED;
