/**
 * Mock Gmail thread fixtures for exact project-thread fetch tests.
 * Not live mailbox data. Bodies exist only in-process for the authorized
 * exact thread. Attachment parts are metadata-only.
 */

import type { GmailApiMessage, GmailApiThread, GmailPayloadPart } from "./types";

export const ACHEDEKAL_THREAD_ID = "19fc1a2b3c4d5e6f";
export const OTHER_PROJECT_THREAD_ID = "18aaa111bbb222cc";
export const ORDERED_THREAD_ID = "19aabbccddeeff01";
export const NO_EVIDENCE_THREAD_ID = "19bbb222ccc333dd";
export const ADJACENCY_THREAD_ID = "19ccc333ddd444ee";

const FOUNDER = "founder@hourglass.example";
const CLIENT = "achedekal@example.com";

export function encodeGmailBody(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function message(input: {
  id: string;
  threadId: string;
  internalDate: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  labelIds?: readonly string[];
  attachment?: { filename: string; mimeType: string; attachmentId: string; size: number };
}): GmailApiMessage {
  const parts: GmailPayloadPart[] = [
    {
      mimeType: "text/plain",
      body: { data: encodeGmailBody(input.body), size: input.body.length },
    },
  ];
  if (input.attachment) {
    parts.push({
      filename: input.attachment.filename,
      mimeType: input.attachment.mimeType,
      body: {
        attachmentId: input.attachment.attachmentId,
        size: input.attachment.size,
        data: null,
      },
    });
  }
  return {
    id: input.id,
    threadId: input.threadId,
    labelIds: input.labelIds ?? ["INBOX"],
    internalDate: input.internalDate,
    snippet: "SHOULD-NOT-BE-THE-PROTECTED-BODY",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: input.from },
        { name: "To", value: input.to },
        { name: "Subject", value: input.subject },
      ],
      parts,
    },
  };
}

export const ACHEDEKAL_CLIENT_MESSAGE = message({
  id: "msg-achedekal-1",
  threadId: ACHEDEKAL_THREAD_ID,
  internalDate: "1724500000000",
  from: CLIENT,
  to: FOUNDER,
  subject: "Achedekal band",
  body: "Confirming the band details for this project.",
  labelIds: ["INBOX"],
});

export const ACHEDEKAL_SIZE_MESSAGE = message({
  id: "msg-achedekal-2",
  threadId: ACHEDEKAL_THREAD_ID,
  internalDate: "1724503600000",
  from: FOUNDER,
  to: CLIENT,
  subject: "Re: Achedekal band",
  body: "Ring size 6.5",
  labelIds: ["SENT"],
  attachment: {
    filename: "cad-render.pdf",
    mimeType: "application/pdf",
    attachmentId: "att-cad-render-1",
    size: 4096,
  },
});

export const ACHEDEKAL_THREAD: GmailApiThread = {
  id: ACHEDEKAL_THREAD_ID,
  messages: [ACHEDEKAL_SIZE_MESSAGE, ACHEDEKAL_CLIENT_MESSAGE],
};

export const OTHER_PROJECT_THREAD: GmailApiThread = {
  id: OTHER_PROJECT_THREAD_ID,
  messages: [
    message({
      id: "msg-other-1",
      threadId: OTHER_PROJECT_THREAD_ID,
      internalDate: "1724510000000",
      from: "other@example.com",
      to: FOUNDER,
      subject: "Other project thread",
      body: "Ring size 7.25",
    }),
  ],
};

export const ORDERED_THREAD: GmailApiThread = {
  id: ORDERED_THREAD_ID,
  messages: [
    message({
      id: "msg-order-3",
      threadId: ORDERED_THREAD_ID,
      internalDate: "1724510800000",
      from: FOUNDER,
      to: CLIENT,
      subject: "Third",
      body: "Latest note.",
    }),
    message({
      id: "msg-order-1",
      threadId: ORDERED_THREAD_ID,
      internalDate: "1724500000000",
      from: CLIENT,
      to: FOUNDER,
      subject: "First",
      body: "Earliest note.",
    }),
    message({
      id: "msg-order-2",
      threadId: ORDERED_THREAD_ID,
      internalDate: "1724503600000",
      from: FOUNDER,
      to: CLIENT,
      subject: "Second",
      body: "Middle note.",
    }),
  ],
};

export const NO_EVIDENCE_THREAD: GmailApiThread = {
  id: NO_EVIDENCE_THREAD_ID,
  messages: [
    message({
      id: "msg-no-size-1",
      threadId: NO_EVIDENCE_THREAD_ID,
      internalDate: "1724500000000",
      from: CLIENT,
      to: FOUNDER,
      subject: "Sketch attached",
      body: "Please see the attached sketch for this project.",
    }),
  ],
};

export const ADJACENCY_THREAD: GmailApiThread = {
  id: ADJACENCY_THREAD_ID,
  messages: [
    message({
      id: "msg-adj-1",
      threadId: ADJACENCY_THREAD_ID,
      internalDate: "1724500000000",
      from: CLIENT,
      to: FOUNDER,
      subject: "Numbers only",
      body: "CAD 141 / order 140. Please keep both identifiers.",
    }),
  ],
};

export const FIXTURE_FOUNDER_EMAIL = FOUNDER;
export const FIXTURE_CLIENT_EMAIL = CLIENT;
