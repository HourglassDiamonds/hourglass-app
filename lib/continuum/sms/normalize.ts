/**
 * Normalize provider-neutral SMS input.
 * Raw phone numbers are hashed and then dropped.
 * Idempotency uses a provider message id, or a fingerprint that excludes
 * display names and contact labels.
 */

import { createHash } from "node:crypto";
import { classifyPhone, hashPhone } from "@/lib/continuum/client-memory/hashes";
import type {
  MessageAdapterInput,
  NormalizedSmsMessage,
  SmsAttachmentMeta,
  SmsDirection,
  SmsParseSurface,
  SmsParticipant,
} from "./types";
import {
  SMS_SOURCE_REF_VERSION,
  UNSPECIFIED_SMS_PROVIDER,
} from "./types";

const SOURCE_REF_MAX = 2048;

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalizeToken(raw: string, label: string): string {
  const text = raw.trim();
  if (!text) throw new Error(`${label}-required`);
  if (text.includes("@") || /[\s|]/.test(text)) throw new Error(`${label}-invalid`);
  return text;
}

function isDirection(value: unknown): value is SmsDirection {
  return value === "inbound" || value === "outbound" || value === "unknown";
}

function participantFromPhone(raw: string | null | undefined): SmsParticipant {
  const classified = classifyPhone(raw);
  if (classified.status === "us-compatible") {
    return { phoneHash: hashPhone(raw), classification: "us-compatible" };
  }
  if (classified.status === "international") {
    return { phoneHash: null, classification: "international" };
  }
  if (classified.status === "too-short") {
    return { phoneHash: null, classification: "too-short" };
  }
  return { phoneHash: null, classification: "blank" };
}

function uniqueParticipants(rows: readonly SmsParticipant[]): SmsParticipant[] {
  const seen = new Set<string>();
  const out: SmsParticipant[] = [];
  for (const row of rows) {
    const key = `${row.classification}:${row.phoneHash ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function normalizeAttachments(
  rows: readonly SmsAttachmentMeta[] | undefined,
): SmsAttachmentMeta[] {
  if (!rows) return [];
  const seen = new Set<string>();
  const out: SmsAttachmentMeta[] = [];
  for (const row of rows) {
    const attachmentId = row.attachmentId.trim();
    if (!attachmentId || seen.has(attachmentId)) continue;
    seen.add(attachmentId);
    out.push({
      attachmentId,
      filename: row.filename?.trim() || null,
      mimeType: row.mimeType?.trim() || null,
      byteSize:
        typeof row.byteSize === "number" && Number.isFinite(row.byteSize)
          ? row.byteSize
          : null,
    });
  }
  return out;
}

function normalizeProvider(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return UNSPECIFIED_SMS_PROVIDER;
  const compact = trimmed.toLowerCase().replace(/\s+/g, "-");
  if (!compact || /[:|@]/.test(compact)) throw new Error("sms-provider-invalid");
  return compact;
}

export function conversationKeyFor(input: {
  sourceThreadId: string | null;
  participantPhoneHashes: readonly string[];
  sourceMessageId: string;
}): string {
  if (input.sourceThreadId) return `sms:thread:${input.sourceThreadId}`;
  const hashes = [...new Set(input.participantPhoneHashes.filter(Boolean))].sort();
  if (hashes.length > 0) return `sms:participants:${sha256Utf8(hashes.join(":"))}`;
  return `sms:message:${input.sourceMessageId}`;
}

export function fallbackSmsMessageId(input: {
  provider: string;
  sentAt: string;
  direction: SmsDirection;
  senderHash: string | null;
  participantHashes: readonly string[];
  body: string | null;
  attachmentIds: readonly string[];
}): string {
  const material = [
    "sms.fallback.v1",
    input.provider,
    input.sentAt.trim(),
    input.direction,
    input.senderHash ?? "",
    [...input.participantHashes].filter(Boolean).sort().join(","),
    sha256Utf8(input.body ?? ""),
    [...input.attachmentIds].sort().join(","),
  ].join("\n");
  return `fallback:${sha256Utf8(material)}`;
}

export function smsIdempotencyKey(provider: string, sourceMessageId: string): string {
  return `sms:${provider}:${sourceMessageId}`;
}

export function packSmsSourceRef(input: {
  provider: string;
  sourceMessageId: string;
  conversationKey: string;
}): string {
  const packed = [
    SMS_SOURCE_REF_VERSION,
    input.provider,
    input.sourceMessageId,
    input.conversationKey,
  ].join("|");
  if (packed.length <= SOURCE_REF_MAX) return packed;
  return `${SMS_SOURCE_REF_VERSION}|${sha256Utf8(packed)}`;
}

export function normalizeSmsMessage(
  input: MessageAdapterInput,
  capturedAt: string,
): SmsParseSurface {
  if (!input.sentAt.trim()) throw new Error("sms-sent-at-required");
  if (!isDirection(input.direction)) throw new Error("sms-direction-invalid");

  const provider = normalizeProvider(input.provider);
  const sourceThreadId = input.sourceThreadId?.trim()
    ? canonicalizeToken(input.sourceThreadId, "sms-thread-id")
    : null;
  const sender = participantFromPhone(input.senderPhone);
  const listed = (input.participantPhones ?? []).map((phone) => participantFromPhone(phone));
  const participants = uniqueParticipants([sender, ...listed]).filter(
    (row) => row.classification !== "blank" || row === sender,
  );
  const participantHashes = participants
    .map((row) => row.phoneHash)
    .filter((value): value is string => Boolean(value));
  const attachments = normalizeAttachments(input.attachments);
  const body = input.body == null ? null : input.body.trim() || null;
  const nativeId = input.sourceMessageId?.trim() ?? "";
  const messageIdWasSynthesized = nativeId.length === 0;
  const sourceMessageId = messageIdWasSynthesized
    ? fallbackSmsMessageId({
        provider,
        sentAt: input.sentAt,
        direction: input.direction,
        senderHash: sender.phoneHash,
        participantHashes,
        body,
        attachmentIds: attachments.map((row) => row.attachmentId),
      })
    : canonicalizeToken(nativeId, "sms-message-id");
  const conversationKey = conversationKeyFor({
    sourceThreadId,
    participantPhoneHashes: participantHashes,
    sourceMessageId,
  });
  const ingestClass = input.ingestClass === "live" ? "live" : "historical";
  const lineClass =
    input.lineClass === "business" || input.lineClass === "personal"
      ? input.lineClass
      : "unknown";

  const message: NormalizedSmsMessage = {
    provider,
    sourceMessageId,
    messageIdWasSynthesized,
    sourceThreadId,
    conversationKey,
    sentAt: input.sentAt.trim(),
    direction: input.direction,
    sender,
    participants,
    attachmentCount: attachments.length,
    hasAttachments: attachments.length > 0,
    attachments,
    idempotencyKey: smsIdempotencyKey(provider, sourceMessageId),
    sourceRef: packSmsSourceRef({
      provider,
      sourceMessageId,
      conversationKey,
    }),
    ingestClass,
    lineClass,
    capturedAt: input.capturedAt?.trim() || capturedAt,
    founderSelected: input.founderSelected === true,
    manuallyRouted: input.manuallyRouted === true,
    routedPersonId: input.routedPersonId?.trim() || null,
    confirmedProjectId: input.confirmedProjectId?.trim() || null,
  };

  return { message, body };
}
