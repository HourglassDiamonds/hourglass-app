/**
 * Standards-compatible vCard 3.0 for a public digital card.
 * Public fields only. No Continuum IDs or private metadata.
 */

import type { PublicDigitalCard } from "./types";

function vcardEscape(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n\r/g, "\n")
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

function splitName(displayName: string): { family: string; given: string } {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { family: "", given: "" };
  if (tokens.length === 1) return { family: "", given: tokens[0] };
  return {
    given: tokens[0],
    family: tokens.slice(1).join(" "),
  };
}

export function buildPublicVcard(card: PublicDigitalCard): string {
  const name = splitName(card.displayName);
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vcardEscape(name.family)};${vcardEscape(name.given)};;;`,
    `FN:${vcardEscape(card.displayName)}`,
  ];

  if (card.memorableTitle) {
    lines.push(`NICKNAME:${vcardEscape(card.memorableTitle)}`);
    lines.push(`NOTE:${vcardEscape(card.memorableTitle)}`);
  }
  if (card.professionalTitle) {
    lines.push(`TITLE:${vcardEscape(card.professionalTitle)}`);
  }
  if (card.company) {
    lines.push(`ORG:${vcardEscape(card.company)}`);
  }
  if (card.phone) {
    const digits = card.phone.replace(/\D+/g, "");
    const tel =
      digits.length === 10 ? `+1${digits}` : digits.length === 11 ? `+${digits}` : card.phone;
    lines.push(`TEL;TYPE=CELL,VOICE:${vcardEscape(tel)}`);
  }
  if (card.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(card.email)}`);
  }
  if (card.websiteUrl) {
    lines.push(`URL:${vcardEscape(card.websiteUrl)}`);
  }
  if (card.linkedinUrl) {
    lines.push(`URL;TYPE=LinkedIn:${vcardEscape(card.linkedinUrl)}`);
  }
  if (card.instagramUrl) {
    lines.push(`URL;TYPE=Instagram:${vcardEscape(card.instagramUrl)}`);
  }
  for (const link of card.additionalLinks) {
    lines.push(`URL;TYPE=${vcardEscape(link.label)}:${vcardEscape(link.url)}`);
  }
  if (card.avatarUrl) {
    lines.push(`PHOTO;VALUE=URI:${vcardEscape(card.avatarUrl)}`);
  }

  lines.push("END:VCARD");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function vcardFilename(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "contact"}.vcf`;
}
