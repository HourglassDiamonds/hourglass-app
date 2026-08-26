/**
 * Public digital-card projection and visitor-facing contact helpers.
 * Strips internal ids, unpublished contact fields, and private Continuum data.
 */

import { isPublicCardSlug } from "./parse";
import type { DigitalCard, PublicDigitalCard } from "./types";

export function toPublicDigitalCard(card: DigitalCard): PublicDigitalCard | null {
  if (!card.published) return null;
  return {
    slug: card.slug,
    displayName: card.displayName,
    memorableTitle: card.memorableTitle,
    professionalTitle: card.professionalTitle,
    company: card.company,
    email: card.emailPublic ? card.email : null,
    phone: card.phonePublic ? card.phone : null,
    websiteUrl: card.websiteUrl,
    linkedinUrl: card.linkedinUrl,
    instagramUrl: card.instagramUrl,
    additionalLinks: card.additionalLinks.map((link) => ({ ...link })),
    avatarUrl: card.avatarUrl,
  };
}

export type PublicDigitalCardLookup =
  | { status: "found"; card: PublicDigitalCard }
  | { status: "not-found" };

export async function lookupPublicDigitalCard(
  slug: string,
  store: { getCardBySlug(slug: string): Promise<DigitalCard | null> },
): Promise<PublicDigitalCardLookup> {
  if (!isPublicCardSlug(slug)) return { status: "not-found" };
  const record = await store.getCardBySlug(slug);
  const publicCard = record ? toPublicDigitalCard(record) : null;
  if (!publicCard) return { status: "not-found" };
  return { status: "found", card: publicCard };
}

export function formatPublicPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return phone.trim() || null;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function publicTelHref(phone: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return null;
}

export function publicSmsHref(phone: string | null): string | null {
  const tel = publicTelHref(phone);
  return tel ? tel.replace(/^tel:/, "sms:") : null;
}

export function publicMailtoHref(email: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return `mailto:${trimmed}`;
}
