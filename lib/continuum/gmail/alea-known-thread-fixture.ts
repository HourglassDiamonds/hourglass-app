/**
 * Known exact Achedekal Gmail thread fixture for reconstruction cleanup.
 * Models the stored CAD-presentation thread only. Not founder memory.
 * Not a live mailbox fetch. automaticApply: false.
 */

import type { ProtectedExactThread } from "./exact-thread-payload";
import type { ProjectReconstructionInput } from "./project-reconstruction";
import { ACHEDEKAL_PROJECT_ID } from "./achedekal-acceptance";

export const ALEA_KNOWN_THREAD_ID = "19fd7d23809b96f9";
export const ALEA_KNOWN_CAD = "CBR2000037";
export const ALEA_KNOWN_FALSE_RENDER_TOKEN = "DB865C70";
export const ALEA_KNOWN_ARTIFACT_FILENAME = "H017-CBR2000037.jpg";

const SUBJECT = "RE: HGD - A. Achedekal-CBR2000037";

export function aleaKnownProtectedThread(): ProtectedExactThread {
  return {
    threadId: ALEA_KNOWN_THREAD_ID,
    messages: [
      {
        messageId: "msg-alea-known-1",
        internalDate: "2026-08-06T15:12:00.000Z",
        direction: "inbound",
        from: "vendor@example.com",
        to: ["founder@hourglass.example"],
        cc: [],
        bcc: [],
        subject: SUBJECT,
        plainText:
          "I'll send you cad CBR2000037 as soon as it's available.",
        mimeParts: [],
        attachments: [
          {
            attachmentId: "att-image001-a",
            messageId: "msg-alea-known-1",
            filename: "image001.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 2048,
          },
        ],
      },
      {
        messageId: "msg-alea-known-2",
        internalDate: "2026-08-07T11:04:00.000Z",
        direction: "inbound",
        from: "vendor@example.com",
        to: ["founder@hourglass.example"],
        cc: [],
        bcc: [],
        subject: SUBJECT,
        plainText: `Please find the following for Cad: CBR2000037
Cad presentation
Click here for video rendering:
https://example.test/render/DB865C70`,
        mimeParts: [],
        attachments: [
          {
            attachmentId: "att-image001-b",
            messageId: "msg-alea-known-2",
            filename: "image001.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 1800,
          },
          {
            attachmentId: "att-h017-cbr",
            messageId: "msg-alea-known-2",
            filename: ALEA_KNOWN_ARTIFACT_FILENAME,
            mimeType: "image/jpeg",
            sizeBytes: 1_540_698,
          },
        ],
      },
    ],
  };
}

export function aleaKnownThreadReconstructionInput(): ProjectReconstructionInput {
  return {
    projectId: ACHEDEKAL_PROJECT_ID,
    currentSpecs: {
      fingerSize: "141",
      orderNumber: "140",
      cadJobNumber: ALEA_KNOWN_CAD,
      metal: null,
      centerStone: null,
    },
    currentLifecycle: "historical_closed",
    existingPerson: {
      personId: "33333333-3333-4333-8333-333333333333",
      displayName: "A. Achedekal",
      emailHash: "b".repeat(64),
    },
    sourceNameEvidence: [],
    thread: aleaKnownProtectedThread(),
    indexedMessages: [],
  };
}
