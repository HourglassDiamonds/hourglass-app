/**
 * Provenance marker for synthesized founder operating mail.
 * Identified by sender hash, never subject or display-name matching.
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";

export const GENERATED_FOUNDER_OPERATING_BRIEF_RULE =
  "generated_founder_operating_brief" as const;

function senderAddressForHash(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim();
}

export function generatedOperatingMailHashesFrom(
  emails: readonly (string | null | undefined)[],
): string[] {
  const hashes: string[] = [];
  const seen = new Set<string>();
  for (const email of emails) {
    const trimmed = email?.trim() ?? "";
    if (!trimmed) continue;
    const hash = hashEmail(senderAddressForHash(trimmed));
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

const EMAIL_HASH_RE = /^[a-f0-9]{64}$/;

export function generatedOperatingMailHashesFromStored(
  raw: string | null | undefined,
): string[] {
  const hashes: string[] = [];
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[,\s]+/)) {
    const hash = part.trim().toLowerCase();
    if (!EMAIL_HASH_RE.test(hash) || seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

/**
 * Cadence / intelligence / Concierge alert senders.
 * Static process.env.* reads so Next server bundles keep the values.
 * Optional CONTINUUM_GENERATED_OPERATING_MAIL_HASHES lists sender hashes
 * already stored on indexed Gmail rows when the plaintext From is not in env.
 */
export function generatedOperatingMailHashesFromEnv(): string[] {
  const hashes = generatedOperatingMailHashesFrom([
    process.env.AGENT_OS_EMAIL_FROM,
    process.env.INTELLIGENCE_EMAIL_FROM,
    process.env.CONCIERGE_ALERT_EMAIL_FROM,
  ]);
  const seen = new Set(hashes);
  for (const hash of generatedOperatingMailHashesFromStored(
    process.env.CONTINUUM_GENERATED_OPERATING_MAIL_HASHES,
  )) {
    if (seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

export function isGeneratedFounderOperatingMail(
  fromEmailHash: string | null | undefined,
  generatedEmailHashes: readonly string[] | undefined,
): boolean {
  const hash = fromEmailHash?.trim() ?? "";
  if (!hash) return false;
  return (generatedEmailHashes ?? []).includes(hash);
}

export function withGeneratedFounderOperatingBriefRule(
  ruleIds: readonly string[],
  generated: boolean,
): readonly string[] {
  if (!generated) return ruleIds;
  if (ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE)) return ruleIds;
  return [...ruleIds, GENERATED_FOUNDER_OPERATING_BRIEF_RULE];
}

export function candidateHasGeneratedOperatingMailRule(
  ruleIds: readonly string[] | null | undefined,
): boolean {
  return (ruleIds ?? []).includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE);
}
