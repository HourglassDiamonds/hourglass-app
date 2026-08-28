/**
 * Founder mailbox binding.
 * Exact match against CONTINUUM_GMAIL_FOUNDER_EMAIL after users.getProfile().
 * Mismatch: do not retain the token; caller must revoke it.
 */

import { hashEmail, normalizeEmail } from "@/lib/continuum/client-memory/hashes";
import { getContinuumGmailFounderEmail } from "./env";

export type MailboxBindResult =
  | { ok: true; mailboxEmailHash: string }
  | {
      ok: false;
      error: "gmail-wrong-mailbox" | "gmail-mailbox-unconfigured";
    };

export function bindFounderMailbox(
  profileEmail: string,
  configuredFounderEmail = getContinuumGmailFounderEmail(),
): MailboxBindResult {
  const expected = normalizeEmail(configuredFounderEmail);
  const actual = normalizeEmail(profileEmail);
  if (!expected) {
    return { ok: false, error: "gmail-mailbox-unconfigured" };
  }
  if (!actual || actual !== expected) {
    return { ok: false, error: "gmail-wrong-mailbox" };
  }
  const mailboxEmailHash = hashEmail(actual);
  if (!mailboxEmailHash) {
    return { ok: false, error: "gmail-wrong-mailbox" };
  }
  return { ok: true, mailboxEmailHash };
}
