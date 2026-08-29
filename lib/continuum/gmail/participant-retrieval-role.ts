/**
 * Retrieval-role contract for project-scoped candidate discovery.
 * An external address is not a client just because it appears on the
 * known project thread. Evidence classification only. automaticApply: false.
 */

import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { internalHourglassEmailHashes } from "./project-reconstruction";

export const PARTICIPANT_RETRIEVAL_ROLES = [
  "can_seed_person_discovery",
  "supporting_only",
  "excluded",
] as const;

export type ParticipantRetrievalRole =
  (typeof PARTICIPANT_RETRIEVAL_ROLES)[number];

export type ParticipantRetrievalClassification = {
  emailHash: string;
  role: ParticipantRetrievalRole;
};

export function classifyParticipantRetrievalRole(input: {
  emailHash: string;
  canonicalPersonEmailHashes?: readonly string[];
  internalEmailHashes?: readonly string[];
}): ParticipantRetrievalRole {
  const hash = input.emailHash.trim();
  if (!hash) return "excluded";
  const internal = new Set([
    ...internalHourglassEmailHashes(),
    ...(input.internalEmailHashes ?? []),
  ]);
  if (internal.has(hash)) return "excluded";
  const canonical = new Set(
    (input.canonicalPersonEmailHashes ?? [])
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (canonical.has(hash)) return "can_seed_person_discovery";
  return "supporting_only";
}

export function personDiscoverySeedHashes(input: {
  canonicalPersonEmailHashes?: readonly string[];
  internalEmailHashes?: readonly string[];
}): string[] {
  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const raw of input.canonicalPersonEmailHashes ?? []) {
    const hash = raw.trim();
    if (!hash || seen.has(hash)) continue;
    if (
      classifyParticipantRetrievalRole({
        emailHash: hash,
        canonicalPersonEmailHashes: input.canonicalPersonEmailHashes,
        internalEmailHashes: input.internalEmailHashes,
      }) !== "can_seed_person_discovery"
    ) {
      continue;
    }
    seen.add(hash);
    seeds.push(hash);
  }
  return seeds;
}

export function indexedMessageTouchesEmailHash(
  row: GmailIndexedMessage,
  emailHash: string,
): boolean {
  const hash = emailHash.trim();
  if (!hash) return false;
  if (row.fromEmailHash === hash) return true;
  return (
    row.toEmailHashes.includes(hash) ||
    row.ccEmailHashes.includes(hash) ||
    row.bccEmailHashes.includes(hash)
  );
}

export function uniqueIndexedParticipantHashes(
  messages: readonly GmailIndexedMessage[],
): string[] {
  const hashes = new Set<string>();
  for (const row of messages) {
    if (row.fromEmailHash) hashes.add(row.fromEmailHash);
    for (const hash of [
      ...row.toEmailHashes,
      ...row.ccEmailHashes,
      ...row.bccEmailHashes,
    ]) {
      if (hash) hashes.add(hash);
    }
  }
  return [...hashes];
}

export function classifyIndexedThreadParticipants(input: {
  messages: readonly GmailIndexedMessage[];
  canonicalPersonEmailHashes?: readonly string[];
  internalEmailHashes?: readonly string[];
}): ParticipantRetrievalClassification[] {
  return uniqueIndexedParticipantHashes(input.messages)
    .sort()
    .map((emailHash) => ({
      emailHash,
      role: classifyParticipantRetrievalRole({
        emailHash,
        canonicalPersonEmailHashes: input.canonicalPersonEmailHashes,
        internalEmailHashes: input.internalEmailHashes,
      }),
    }));
}

export function threadTouchesPersonDiscoverySeed(
  messages: readonly GmailIndexedMessage[],
  seedHashes: readonly string[],
): boolean {
  return seedHashes.some((hash) =>
    messages.some((row) => indexedMessageTouchesEmailHash(row, hash)),
  );
}
