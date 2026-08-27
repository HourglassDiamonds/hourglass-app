/**
 * Inbox / Sent Gmail API fixtures for mock sync.
 * Metadata + attachment parts only. Tests must not persist body/snippet.
 */

import type { GmailApiMessage } from "./types";

const FOUNDER = "founder@hourglass.example";
const CLIENT = "client@example.com";

export const INBOX_FIXTURE_MESSAGE: GmailApiMessage = {
  id: "msg-inbox-1",
  threadId: "thread-sarah-1",
  labelIds: ["INBOX", "UNREAD"],
  internalDate: "1724500000000",
  snippet: "SHOULD-NOT-PERSIST anniversary band details",
  payload: {
    mimeType: "multipart/mixed",
    headers: [
      { name: "From", value: `${CLIENT}` },
      { name: "To", value: FOUNDER },
      { name: "Cc", value: "studio@hourglass.example" },
      { name: "Bcc", value: "" },
      { name: "Subject", value: "Anniversary band" },
      { name: "Date", value: "Mon, 24 Aug 2026 12:00:00 -0400" },
    ],
    parts: [
      {
        mimeType: "text/plain",
        body: { data: "U0hPVUxELU5PVC1QRVJTSVNU", size: 20 },
      },
      {
        filename: "sketch.pdf",
        mimeType: "application/pdf",
        body: { attachmentId: "att-sketch-1", size: 2048, data: null },
      },
    ],
  },
};

export const SENT_FIXTURE_MESSAGE: GmailApiMessage = {
  id: "msg-sent-1",
  threadId: "thread-sarah-1",
  labelIds: ["SENT"],
  internalDate: "1724503600000",
  snippet: "SHOULD-NOT-PERSIST outbound reply",
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: FOUNDER },
      { name: "To", value: CLIENT },
      { name: "Subject", value: "Re: Anniversary band" },
      { name: "Date", value: "Mon, 24 Aug 2026 13:00:00 -0400" },
    ],
    body: { size: 12, data: "b3V0Ym91bmQ=" },
  },
};

export const SELF_SENT_FIXTURE_MESSAGE: GmailApiMessage = {
  id: "msg-self-1",
  threadId: "thread-self-1",
  labelIds: ["INBOX", "SENT"],
  internalDate: "1724507200000",
  payload: {
    headers: [
      { name: "From", value: FOUNDER },
      { name: "To", value: FOUNDER },
      { name: "Subject", value: "Note to self" },
    ],
  },
};

export const BCC_FIXTURE_MESSAGE: GmailApiMessage = {
  id: "msg-bcc-1",
  threadId: "thread-bcc-1",
  labelIds: ["SENT"],
  internalDate: "1724510800000",
  payload: {
    headers: [
      { name: "From", value: FOUNDER },
      { name: "To", value: CLIENT },
      { name: "Bcc", value: "partner@example.com" },
      { name: "Subject", value: "Quiet copy" },
    ],
  },
};

export const FIXTURE_FOUNDER_EMAIL = FOUNDER;
export const FIXTURE_CLIENT_EMAIL = CLIENT;
