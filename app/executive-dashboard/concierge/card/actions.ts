"use server";

import { saveAuthenticatedDigitalCard } from "@/lib/continuum/digital-card/load";
import type { DigitalCard, DigitalCardAdditionalLink } from "@/lib/continuum/digital-card/types";

export type SaveOwnerCardState =
  | { status: "saved"; card: DigitalCard; message?: undefined }
  | { status: "error"; message: string; card?: undefined };

function isChecked(value: FormDataEntryValue | null): boolean {
  const raw = String(value ?? "");
  return raw === "true" || raw === "on" || raw === "1";
}

function extraLinks(formData: FormData): DigitalCardAdditionalLink[] {
  const links: DigitalCardAdditionalLink[] = [];
  for (const index of [1, 2]) {
    const label = String(formData.get(`link${index}Label`) ?? "").trim();
    const url = String(formData.get(`link${index}Url`) ?? "").trim();
    if (label && url) links.push({ label, url });
  }
  return links;
}

export async function saveOwnerCard(
  _prev: SaveOwnerCardState | null,
  formData: FormData,
): Promise<SaveOwnerCardState> {
  const result = await saveAuthenticatedDigitalCard({
    displayName: String(formData.get("displayName") ?? ""),
    memorableTitle: String(formData.get("memorableTitle") ?? ""),
    professionalTitle: String(formData.get("professionalTitle") ?? ""),
    company: String(formData.get("company") ?? ""),
    email: String(formData.get("email") ?? ""),
    emailPublic: isChecked(formData.get("emailPublic")),
    phone: String(formData.get("phone") ?? ""),
    phonePublic: isChecked(formData.get("phonePublic")),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    published: isChecked(formData.get("published")),
    additionalLinks: extraLinks(formData),
  });

  if (result.status === "saved") {
    return { status: "saved", card: result.card };
  }
  if (result.status === "unauthorized") {
    return { status: "error", message: "Sign in to continue." };
  }
  if (result.status === "validation-error") {
    return { status: "error", message: result.message };
  }
  return { status: "error", message: "Unable to save the card." };
}
