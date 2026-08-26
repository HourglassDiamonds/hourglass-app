/**
 * Public digital-card reads and share ingest. No founder session.
 * Returns published public DTOs only — never internal ids or private fields.
 */

import "server-only";

import { ingestDigitalCardShare } from "./ingest";
import { createDigitalCardIngestDeps } from "./ingest-deps";
import { lookupPublicDigitalCard } from "./public";
import { createSupabaseDigitalCardStore } from "./server";
import type { DigitalCardStore } from "./store";
import type { PublicDigitalCard, ShareContactInput, ShareContactResult } from "./types";

export type PublicDigitalCardLoad =
  | { status: "found"; card: PublicDigitalCard }
  | { status: "not-found" }
  | { status: "unavailable" };

export async function loadPublicDigitalCard(
  slug: string,
  store?: DigitalCardStore,
): Promise<PublicDigitalCardLoad> {
  try {
    const cards = store ?? createSupabaseDigitalCardStore();
    return await lookupPublicDigitalCard(slug, cards);
  } catch {
    return { status: "unavailable" };
  }
}

export async function submitPublicDigitalCardShare(
  input: ShareContactInput,
  store?: DigitalCardStore,
): Promise<ShareContactResult> {
  const cards = store ?? createSupabaseDigitalCardStore();
  return ingestDigitalCardShare(createDigitalCardIngestDeps(cards), input);
}
