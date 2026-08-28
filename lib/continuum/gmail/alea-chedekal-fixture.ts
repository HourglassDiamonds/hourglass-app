/**
 * Synthetic Alea Chedekal reconstruction fixture.
 * Models STRUCTURAL complexity only. Not production truth.
 * Not founder-remembered facts. Not a live mailbox thread.
 * Does not write canonical records. automaticApply: false.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type {
  ProtectedExactThread,
  ProtectedExactThreadMessage,
} from "./exact-thread-payload";
import type { ProjectReconstructionInput } from "./project-reconstruction";

export const ALEA_CHEDEKAL_FIXTURE_PROJECT_ID =
  "fixture-alea-chedekal-reconstruction";

export const ALEA_CHEDEKAL_FIXTURE_PERSON_ID =
  "11111111-1111-4111-8111-111111111111";

export const ALEA_CHEDEKAL_FIXTURE_THREAD_ID = "19fixturealeachedek01";

export const ALEA_CHEDEKAL_FIXTURE_EMAIL = "chedekal@example.com";

export const ALEA_CHEDEKAL_CANONICAL_NAME = "A. Chedekal";

export const ALEA_CHEDEKAL_SOURCE_NAME = "Alea Chedekal";

const FOUNDER = "founder@hourglass.example";

function message(input: {
  messageId: string;
  internalDate: string;
  direction: ProtectedExactThreadMessage["direction"];
  from: string;
  to: readonly string[];
  subject: string;
  plainText: string;
  attachments?: ProtectedExactThreadMessage["attachments"];
}): ProtectedExactThreadMessage {
  return {
    messageId: input.messageId,
    internalDate: input.internalDate,
    direction: input.direction,
    from: input.from,
    to: input.to,
    cc: [],
    bcc: [],
    subject: input.subject,
    plainText: input.plainText,
    mimeParts: [],
    attachments: input.attachments ?? [],
  };
}

export function aleaChedekalProtectedThread(): ProtectedExactThread {
  return {
    threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
    messages: [
      message({
        messageId: "msg-alea-stones",
        internalDate: "2024-03-12T15:04:00.000Z",
        direction: "outbound",
        from: FOUNDER,
        to: [ALEA_CHEDEKAL_FIXTURE_EMAIL],
        subject: "Loose stones invoice",
        plainText:
          "Attached is the invoice for two loose marquise champagne-colored stones purchased from Vendor North. Order #4401.",
        attachments: [
          {
            attachmentId: "att-stones-invoice",
            messageId: "msg-alea-stones",
            filename: "loose-stones-invoice.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
          },
        ],
      }),
      message({
        messageId: "msg-alea-bracelet",
        internalDate: "2024-04-02T18:22:00.000Z",
        direction: "inbound",
        from: ALEA_CHEDEKAL_FIXTURE_EMAIL,
        to: [FOUNDER],
        subject: "Bracelet concept",
        plainText:
          "We discussed a marquise champagne diamond station / diamonds-by-the-yard bracelet, around 6.5 or 7 inches. Best, Alea Chedekal.",
      }),
      message({
        messageId: "msg-alea-cad",
        internalDate: "2024-04-03T12:00:00.000Z",
        direction: "outbound",
        from: FOUNDER,
        to: [ALEA_CHEDEKAL_FIXTURE_EMAIL],
        subject: "CAD presentation",
        plainText:
          "CAD presentation attached for the bracelet concept. Please also see CAD-8821. Final bracelet length 6.75 inches would be a later decision if this proceeds.",
        attachments: [
          {
            attachmentId: "att-cad-presentation",
            messageId: "msg-alea-cad",
            filename: "cad-presentation.pdf",
            mimeType: "application/pdf",
            sizeBytes: 4096,
          },
        ],
      }),
    ],
  };
}

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
}): GmailIndexedMessage {
  const fromEmailHash = hashEmail(input.fromEmail)!;
  const toEmailHash = hashEmail(input.toEmail)!;
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: "2026-08-28T00:00:00.000Z",
    subject: input.subject,
    fromEmailHash,
    toEmailHashes: [toEmailHash],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "unknown",
    labelIds: [],
    hasAttachments: false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

export function aleaChedekalIndexedMessages(): GmailIndexedMessage[] {
  const person = ALEA_CHEDEKAL_FIXTURE_EMAIL;
  return [
    indexed({
      messageId: "idx-anchor-1",
      threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      sentAt: "2024-03-12T15:04:00.000Z",
      subject: "Loose stones invoice",
      fromEmail: FOUNDER,
      toEmail: person,
    }),
    indexed({
      messageId: "idx-related-cad",
      threadId: "19relatedcad8821aaaa",
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "CAD-8821 follow-up",
      fromEmail: FOUNDER,
      toEmail: person,
    }),
    indexed({
      messageId: "idx-related-term",
      threadId: "19relatedbraceletbbbb",
      sentAt: "2024-04-05T10:00:00.000Z",
      subject: "Champagne bracelet sketch",
      fromEmail: person,
      toEmail: FOUNDER,
    }),
    indexed({
      messageId: "idx-unrelated-person-only",
      threadId: "19unrelatedhello0001",
      sentAt: "2025-01-01T10:00:00.000Z",
      subject: "Hello",
      fromEmail: person,
      toEmail: FOUNDER,
    }),
    indexed({
      messageId: "idx-unrelated-other-client",
      threadId: "19otherclientthread01",
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "CAD-9999 other client",
      fromEmail: "other@example.com",
      toEmail: FOUNDER,
    }),
  ];
}

export function aleaChedekalReconstructionInput(): ProjectReconstructionInput {
  const emailHash = hashEmail(ALEA_CHEDEKAL_FIXTURE_EMAIL);
  return {
    projectId: ALEA_CHEDEKAL_FIXTURE_PROJECT_ID,
    currentSpecs: {
      fingerSize: "141",
      orderNumber: null,
      cadJobNumber: null,
      metal: null,
      centerStone: null,
    },
    currentLifecycle: "historical_closed",
    existingPerson: {
      personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
      displayName: ALEA_CHEDEKAL_CANONICAL_NAME,
      emailHash,
    },
    sourceNameEvidence: [
      {
        sourceSystem: "client-memory",
        displayName: ALEA_CHEDEKAL_CANONICAL_NAME,
        emailHash,
      },
      {
        sourceSystem: "gmail",
        displayName: ALEA_CHEDEKAL_SOURCE_NAME,
        emailHash,
      },
    ],
    thread: aleaChedekalProtectedThread(),
    indexedMessages: aleaChedekalIndexedMessages(),
  };
}
