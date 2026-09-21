/**
 * Currentness for founder-owned Today obligations.
 * A verb in recommended copy is not enough to keep an Up Next item.
 * Read-model only.
 */

import { isMeaningfulTodayActionText } from "@/lib/continuum/candidates/founder-attention";
import { extractInboundObligation } from "./inbound-obligation";
import {
  isIdentityCleanupText,
  isIdentifierOnlyProse,
  remainingIsPrintCheck,
} from "./briefing-packet";
import { isImmediateCommitmentText } from "./thread-truth";

const GENERIC_FALLBACK_OBLIGATION =
  /send the recap(?:\s*\/\s*|\s+and\s+)next step|do this now\.?$|do it, or add it to top 5|^your turn\.?$|review the latest shop (?:turn|update)/i;
const RELATIONSHIP_PROMISE =
  /\b(?:keep you posted|as we get (?:a little )?closer|give an exact|i(?:'ll| will) get back)\b/i;
const CONCRETE_PROMISE_DELIVERABLE = /\b(?:send|get|show|check|video|chain|pricing|availability)\b/i;
const CURRENT_INBOUND_ASK =
  /\b(?:can you|could you|could we|can we|would you|please) (?:send|make|revise|update|do|change|confirm|fix|show|get|follow up|try|call|email)\b/i;
const DATED_FOLLOW_UP =
  /\b(?:call|email|follow up|send)\b[^.!?\n]{0,80}\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/i;

function folded(text: string | null | undefined): string {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

function isNameOnlyLabel(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) return false;
  return tokens.every(
    (token) => /^[A-Z][A-Za-z'’.\-]*$/.test(token) || /^[A-Z]\.?$/.test(token),
  );
}

export function isCurrentInboundAskText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  if (isGenericFallbackObligationText(hay) || isRelationshipPromiseText(hay)) return false;
  if (extractInboundObligation(hay)) return true;
  return CURRENT_INBOUND_ASK.test(hay);
}

export function isGenericFallbackObligationText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  return GENERIC_FALLBACK_OBLIGATION.test(hay);
}

export function isRelationshipPromiseText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  if (!RELATIONSHIP_PROMISE.test(hay)) return false;
  return !CONCRETE_PROMISE_DELIVERABLE.test(hay) || /\bkeep you posted\b/i.test(hay);
}

export function isAmbiguousFollowUpFragment(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!/\bfollow up\b/i.test(hay)) return false;
  if (CURRENT_INBOUND_ASK.test(hay)) return false;
  if (isImmediateCommitmentText(hay)) return false;
  if (DATED_FOLLOW_UP.test(hay)) return false;
  return true;
}

export function isCurrentFounderOwnedObligationText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  if (isIdentityCleanupText(hay) || isIdentifierOnlyProse(hay)) return false;
  if (isGenericFallbackObligationText(hay)) return false;
  if (isAmbiguousFollowUpFragment(hay)) return false;
  if (extractInboundObligation(hay)) return true;
  if (isImmediateCommitmentText(hay)) return true;
  if (isRelationshipPromiseText(hay)) return false;
  if (CURRENT_INBOUND_ASK.test(hay)) return true;
  if (DATED_FOLLOW_UP.test(hay)) return true;
  if (/\?/.test(hay) && isMeaningfulTodayActionText(hay)) return true;
  if (
    remainingIsPrintCheck({
      matchedText: hay,
      headline: hay,
      explanation: hay,
      recommended: hay,
    })
  ) {
    return true;
  }
  if (!isMeaningfulTodayActionText(hay)) return false;
  if (isGenericFallbackObligationText(hay)) return false;
  return !isRelationshipPromiseText(hay) && !isAmbiguousFollowUpFragment(hay);
}

export function isCurrentClientTurnText(text: string | null | undefined): boolean {
  const hay = folded(text);
  if (!hay) return false;
  if (isIdentityCleanupText(hay) || isIdentifierOnlyProse(hay)) return false;
  if (isGenericFallbackObligationText(hay)) return false;
  if (isAmbiguousFollowUpFragment(hay)) return false;
  if (isRelationshipPromiseText(hay) && !isImmediateCommitmentText(hay)) return false;
  if (isNameOnlyLabel(hay)) return false;
  if (isCurrentFounderOwnedObligationText(hay)) return true;
  const words = hay.split(/\s+/).filter((word) => /[a-zA-Z]{3,}/.test(word));
  return words.length >= 2;
}
