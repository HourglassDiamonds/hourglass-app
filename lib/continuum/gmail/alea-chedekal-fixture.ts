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

export const ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID =
  "fixture-alea-chedekal-project-b";

export const ALEA_CHEDEKAL_FIXTURE_PERSON_ID =
  "11111111-1111-4111-8111-111111111111";

export const ALEA_CHEDEKAL_FIXTURE_THREAD_ID = "19fixturealeachedek01";

export const ALEA_CHEDEKAL_PROJECT_B_THREAD_ID = "19fixturealeaprojectb1";

export const ALEA_CHEDEKAL_PROJECT_A_CAD = "CAD-8821";

export const ALEA_CHEDEKAL_PROJECT_A_ORDER = "4401";

export const ALEA_CHEDEKAL_PROJECT_B_CAD = "CAD-3308";

export const ALEA_CHEDEKAL_PROJECT_B_ORDER = "9902";

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
  direction?: GmailIndexedMessage["direction"];
  labelIds?: readonly string[];
  hasAttachments?: boolean;
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
    direction: input.direction ?? "unknown",
    labelIds: [...(input.labelIds ?? [])],
    hasAttachments: input.hasAttachments ?? false,
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

export function aleaChedekalProjectBProtectedThread(): ProtectedExactThread {
  return {
    threadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
    messages: [
      message({
        messageId: "msg-alea-project-b-necklace",
        internalDate: "2026-05-18T14:00:00.000Z",
        direction: "inbound",
        from: ALEA_CHEDEKAL_FIXTURE_EMAIL,
        to: [FOUNDER],
        subject: "Anniversary necklace",
        plainText:
          "This is a later separate engagement: anniversary necklace CAD-3308. Order #9902. Best, Alea Chedekal.",
        attachments: [
          {
            attachmentId: "att-necklace-cad",
            messageId: "msg-alea-project-b-necklace",
            filename: "anniversary-necklace-cad.pdf",
            mimeType: "application/pdf",
            sizeBytes: 3072,
          },
        ],
      }),
    ],
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
    indexed({
      messageId: "idx-project-b-anchor",
      threadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
      sentAt: "2026-05-18T14:00:00.000Z",
      subject: "Anniversary necklace CAD-3308",
      fromEmail: person,
      toEmail: FOUNDER,
    }),
  ];
}

export const ALEA_DISCOVERY_RELATED_CAD_THREAD_ID = "19relatedcad8821aaaa";
export const ALEA_DISCOVERY_MULTI_CAD_THREAD_ID = "19multicad8821aaaaaa";
export const ALEA_DISCOVERY_WEAK_SUPPORT_THREAD_ID = "19weaktypedsupport001";
export const ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID = "19vendorunrelatedjob01";
export const ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID = "19weakorderonly000001";
export const ALEA_DISCOVERY_INTERNAL_THREAD_ID = "19internalhourglass01";
export const ALEA_DISCOVERY_SPAM_THREAD_ID = "19spamcad8821aaaaaa";
export const ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID = "19unrelatedhello0001";
export const ALEA_DISCOVERY_OTHER_CLIENT_THREAD_ID = "19otherclientthread01";
export const ALEA_DISCOVERY_BRACELET_TERM_THREAD_ID = "19relatedbraceletbbbb";

export function aleaChedekalDiscoveryIndexedMessages(): GmailIndexedMessage[] {
  const person = ALEA_CHEDEKAL_FIXTURE_EMAIL;
  const studio = "studio@hourglass.example";
  const vendor = "workshop@example.com";
  return [
    indexed({
      messageId: "idx-anchor-1",
      threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      sentAt: "2024-03-12T15:04:00.000Z",
      subject: "Loose stones invoice from Vendor North",
      fromEmail: FOUNDER,
      toEmail: person,
      direction: "outbound",
    }),
    indexed({
      messageId: "idx-anchor-2",
      threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      sentAt: "2024-04-02T18:22:00.000Z",
      subject: "Bracelet concept",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-anchor-3",
      threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
      sentAt: "2024-04-03T12:00:00.000Z",
      subject: "CAD presentation CAD-8821",
      fromEmail: FOUNDER,
      toEmail: person,
      direction: "outbound",
      hasAttachments: true,
    }),
    indexed({
      messageId: "idx-related-cad",
      threadId: ALEA_DISCOVERY_RELATED_CAD_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "CAD-8821 follow-up",
      fromEmail: FOUNDER,
      toEmail: person,
      direction: "outbound",
      hasAttachments: true,
    }),
    indexed({
      messageId: "idx-multi-cad-1",
      threadId: ALEA_DISCOVERY_MULTI_CAD_THREAD_ID,
      sentAt: "2024-04-06T10:00:00.000Z",
      subject: "CAD-8821 files",
      fromEmail: FOUNDER,
      toEmail: person,
      direction: "outbound",
    }),
    indexed({
      messageId: "idx-multi-cad-2",
      threadId: ALEA_DISCOVERY_MULTI_CAD_THREAD_ID,
      sentAt: "2024-04-06T11:00:00.000Z",
      subject: "Re: CAD-8821 files",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-multi-cad-3",
      threadId: ALEA_DISCOVERY_MULTI_CAD_THREAD_ID,
      sentAt: "2024-04-06T12:00:00.000Z",
      subject: "CAD-8821 from Vendor North",
      fromEmail: vendor,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-weak-support",
      threadId: ALEA_DISCOVERY_WEAK_SUPPORT_THREAD_ID,
      sentAt: "2024-04-05T10:00:00.000Z",
      subject: "Order #4401 Vendor North",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-vendor-unrelated",
      threadId: ALEA_DISCOVERY_VENDOR_UNRELATED_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "Vendor North job CAD-9999",
      fromEmail: vendor,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-unrelated-person-only",
      threadId: ALEA_DISCOVERY_GENERIC_PERSON_THREAD_ID,
      sentAt: "2025-01-01T10:00:00.000Z",
      subject: "Hello",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-weak-order-only",
      threadId: ALEA_DISCOVERY_WEAK_ORDER_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "Invoice 4401",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-project-b-anchor",
      threadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
      sentAt: "2026-05-18T14:00:00.000Z",
      subject: "Anniversary necklace CAD-3308",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
    }),
    indexed({
      messageId: "idx-internal-only",
      threadId: ALEA_DISCOVERY_INTERNAL_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "Hourglass studio checklist",
      fromEmail: FOUNDER,
      toEmail: studio,
      direction: "outbound",
    }),
    indexed({
      messageId: "idx-spam-cad",
      threadId: ALEA_DISCOVERY_SPAM_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "CAD-8821 spam offer",
      fromEmail: "spam@example.com",
      toEmail: FOUNDER,
      labelIds: ["SPAM"],
    }),
    indexed({
      messageId: "idx-unrelated-other-client",
      threadId: ALEA_DISCOVERY_OTHER_CLIENT_THREAD_ID,
      sentAt: "2024-04-04T10:00:00.000Z",
      subject: "CAD-9999 other client",
      fromEmail: "other@example.com",
      toEmail: FOUNDER,
    }),
    indexed({
      messageId: "idx-related-term",
      threadId: ALEA_DISCOVERY_BRACELET_TERM_THREAD_ID,
      sentAt: "2024-04-05T10:00:00.000Z",
      subject: "Champagne bracelet sketch",
      fromEmail: person,
      toEmail: FOUNDER,
      direction: "inbound",
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
