/**
 * Gmail message direction for the founder mailbox.
 * outbound: SENT label OR From hashes to the bound founder mailbox
 * inbound: INBOX and From is not founder
 * self-sent: outbound
 * otherwise: unknown
 */

import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { GmailMessageDirection } from "@/lib/continuum/client-memory/gmail/types";

export function gmailMessageDirection(input: {
  labelIds: readonly string[];
  fromEmail?: string | null;
  founderMailboxHash: string;
}): GmailMessageDirection {
  const labels = new Set(input.labelIds.map((label) => label.trim().toUpperCase()));
  const fromHash = hashEmail(input.fromEmail);
  const fromFounder = Boolean(fromHash && fromHash === input.founderMailboxHash);

  if (labels.has("SENT") || fromFounder) return "outbound";
  if (labels.has("INBOX") && !fromFounder) return "inbound";
  return "unknown";
}
