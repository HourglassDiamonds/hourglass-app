import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";

export const DIGITAL_CARD_PUBLIC_PREFIX = "/c";

export function conciergeMyCardPath(): string {
  return `${CONCIERGE_HOME_PATH}/card`;
}

export function publicCardPath(slug: string): string {
  return `${DIGITAL_CARD_PUBLIC_PREFIX}/${slug.trim()}`;
}

export function publicCardVcardPath(slug: string): string {
  return `${publicCardPath(slug)}/vcard`;
}
