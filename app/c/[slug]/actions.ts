"use server";

import { headers } from "next/headers";
import { submitPublicDigitalCardShare } from "@/lib/continuum/digital-card/public-load";
import {
  checkDigitalCardShareRateLimit,
  getDigitalCardClientIp,
} from "@/lib/continuum/digital-card/rate-limit";

export type ShareDigitalCardState =
  | { ok: true; message?: undefined }
  | { ok: false; message: string };

export async function shareDigitalCardContact(
  _prev: ShareDigitalCardState | null,
  formData: FormData,
): Promise<ShareDigitalCardState> {
  try {
    const headerList = await headers();
    const ip = getDigitalCardClientIp(headerList);
    const limited = checkDigitalCardShareRateLimit(ip);
    if (!limited.allowed) {
      return { ok: false, message: "Please wait a moment before sending again." };
    }

    const result = await submitPublicDigitalCardShare({
      submissionId: String(formData.get("submissionId") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      company: String(formData.get("company") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? ""),
      consent: String(formData.get("consent") ?? "") === "true",
      contextToken: String(formData.get("contextToken") ?? "") || null,
      honeypot: String(formData.get("company_website") ?? ""),
    });

    if (result.status === "ignored" || result.status === "accepted") {
      return { ok: true };
    }
    if (result.status === "validation-error") {
      return { ok: false, message: result.message };
    }
    if (result.status === "rate-limited") {
      return { ok: false, message: "Please wait a moment before sending again." };
    }
    return { ok: false, message: "Unable to send your details just now." };
  } catch {
    return { ok: false, message: "Unable to send your details just now." };
  }
}
