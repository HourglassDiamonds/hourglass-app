/**
 * Founder-owned digital card writer.
 * One card per Continuum owner. Does not edit Person profiles.
 */

import { parseDigitalCardFields, suggestSlugFromName } from "./parse";
import {
  DIGITAL_CARD_SOURCE_SYSTEM,
  type DigitalCard,
  type SaveDigitalCardInput,
  type SaveDigitalCardResult,
} from "./types";

export type SaveOwnerDigitalCardDeps = {
  nowIso: () => string;
  newId: () => string;
  ownerUsername: string;
  getCardByOwner: (ownerUsername: string) => Promise<DigitalCard | null>;
  getCardBySlug: (slug: string) => Promise<DigitalCard | null>;
  upsertCard: (card: DigitalCard) => Promise<DigitalCard>;
};

export async function saveOwnerDigitalCard(
  deps: SaveOwnerDigitalCardDeps,
  input: SaveDigitalCardInput,
): Promise<SaveDigitalCardResult> {
  const parsed = parseDigitalCardFields(input);
  if (!parsed.ok) {
    return {
      status: "validation-error",
      code: parsed.code,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }

  try {
    const existing = await deps.getCardByOwner(deps.ownerUsername);
    const slug = parsed.value.slug ?? existing?.slug ?? suggestSlugFromName(parsed.value.displayName);
    const taken = await deps.getCardBySlug(slug);
    if (taken && taken.id !== existing?.id) {
      return {
        status: "validation-error",
        code: "slug-taken",
        message: "That public link is already in use.",
        fieldErrors: { slug: "That public link is already in use." },
      };
    }

    const now = deps.nowIso();
    const card: DigitalCard = {
      id: existing?.id ?? deps.newId(),
      ownerUsername: deps.ownerUsername,
      ownerPersonId: existing?.ownerPersonId ?? null,
      slug,
      published: parsed.value.published,
      displayName: parsed.value.displayName,
      memorableTitle: parsed.value.memorableTitle,
      professionalTitle: parsed.value.professionalTitle,
      company: parsed.value.company,
      email: parsed.value.email,
      emailPublic: parsed.value.emailPublic,
      phone: parsed.value.phone,
      phonePublic: parsed.value.phonePublic,
      websiteUrl: parsed.value.websiteUrl,
      linkedinUrl: parsed.value.linkedinUrl,
      instagramUrl: parsed.value.instagramUrl,
      additionalLinks: parsed.value.additionalLinks,
      avatarUrl: parsed.value.avatarUrl,
      sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = await deps.upsertCard(card);
    return { status: "saved", card: saved };
  } catch {
    return { status: "error" };
  }
}
