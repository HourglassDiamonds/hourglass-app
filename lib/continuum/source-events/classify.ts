/**
 * Coarse current-work class from a source message.
 * Operates on author-owned current text, subject, actor, and this-message files.
 * Quoted historical text is ignored. Read-model only.
 */

import { authorOwnedText, quotedText } from "@/lib/continuum/gmail/candidates/spec-provenance";
import type {
  SourceCommunicationActor,
  SourceCommunicationEventClass,
} from "./types";

const CAD_FILE = /NL-H017-.+-C\d{5,}/i;
const STL_FILE = /\.stl\b|\bstl\b/i;
const MOD_TOKEN = /\bmod\s*\d+\b|-Mod\s*\d+/i;
const RN_JOB = /\bRN\d{4,}\b/i;
const WORKSHOP =
  /\b(?:workshop|going to (?:the )?workshop|stone is going|final CAD|final cad)\b/i;
const ARTIFACT_DELIVERED =
  /\b(?:here is|attached|delivered|sent)\b[^.!?\n]{0,80}\b(?:mod\s*\d+\s+)?(?:stl|cad)\b|\b(?:mod\s*\d+\s+)?(?:stl|cad)\b[^.!?\n]{0,40}\b(?:attached|delivered|sent)\b/i;
const CAD_FORTHCOMING =
  /\b(?:updated CAD|CAD as soon as|I(?:'ll| will) send (?:you )?(?:the )?(?:updated )?(?:CAD|STL|file)|final CAD|CAD in (?:about |approximately )?\d+)\b/i;
const VENDOR_ACK =
  /^(?:thank you(?: so much)?!?|thanks!?|got it!?|perfect!?|sounds good!?)[\s.]*$/i;
const CLIENT_APPROVES =
  /\b(?:love(?:s|d)? (?:it|the|option)|looks (?:great|perfect|amazing)|approved|let(?:'s| us) move forward|move(?:ing)? forward)\b/i;
const REQUEST =
  /\b(?:can you|could you|please)\s+(?:send|make|revise|update|price|quote|confirm|change)\b|\bneed you to\b|\?/;
const SHIPPING =
  /\b(?:shipping address|new address|updated address|please (?:use|ship to) (?:this |the )?(?:updated )?address)\b/i;
const FOUNDER_VENDOR_INSTRUCTION =
  /\b(?:(?<!before )moving forward|please proceed|please send (?:the )?(?:stl|cad)|latest version looks like winner|use this (?:for|on) (?:the )?(?:cad|update)|headed to the shop)\b/i;
const FOUNDER_PRINT_PLAN =
  /\bI(?:'ll| will| am going to| planned to)?\s*(?:print|check|show|look at)[^.!?\n]{0,180}|\b(?:print(?:ing)?|check(?:ing)?)\s+(?:the\s+)?(?:updated\s+)?(?:model|stl|earring|huggie|size|proportion)/i;
const FOUNDER_CLIENT_UPDATE =
  /\blet me know what you think\b|\bhere(?:'s| is) the (?:latest |updated )?(?:cad|stl|render|design)\b|\bthoughts\??\b/i;
const FOUNDER_FULFILL =
  /\bheaded to you\b|\b(?:i(?:'m| am) )?(?:mail(?:ing)?|ship(?:ping)?)\b|\bi(?:'ll| will) send (?:it|them|this)\b/i;
const HGD_VENDOR_THREAD = /\bHGD\s*x\s+.+-C\d{5,}/i;
const DISCREPANCY = /\b(?:discrepanc|report .{0,40}asap|please (?:review|check|confirm|report))\b/i;

export type ClassifySourceCommunicationInput = {
  actor: SourceCommunicationActor;
  direction: "inbound" | "outbound" | "unknown";
  subject: string | null;
  authorOwnedText: string;
  quotedText?: string;
  attachmentFilenames?: readonly string[];
  hasAttachments?: boolean;
};

function folded(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function fileHay(names: readonly string[] | undefined): string {
  return (names ?? []).join("\n");
}

function ownHay(input: ClassifySourceCommunicationInput): string {
  const own = authorOwnedText(input.authorOwnedText) || input.authorOwnedText;
  const quoted = quotedText(input.quotedText || input.authorOwnedText);
  const ownFolded = folded(own);
  if (quoted && ownFolded && folded(quoted) === ownFolded) return "";
  return [ownFolded, folded(input.subject), fileHay(input.attachmentFilenames)]
    .filter(Boolean)
    .join("\n");
}

function hasCadArtifact(input: ClassifySourceCommunicationInput, hay: string): boolean {
  const files = fileHay(input.attachmentFilenames);
  if (CAD_FILE.test(files) || MOD_TOKEN.test(files) || STL_FILE.test(files)) return true;
  return ARTIFACT_DELIVERED.test(hay);
}

function vendorShopThread(subject: string | null): boolean {
  return HGD_VENDOR_THREAD.test(subject ?? "");
}

export function classifySourceCommunication(
  input: ClassifySourceCommunicationInput,
): SourceCommunicationEventClass {
  const hay = ownHay(input);
  const files = fileHay(input.attachmentFilenames);
  const actor = input.actor;
  const outbound = input.direction === "outbound" || actor === "founder";

  if (actor === "vendor_shop" || (actor === "unknown" && vendorShopThread(input.subject) && !outbound)) {
    if (
      /\bi(?:'ll| will)\b.{0,80}\border confirmation\b/i.test(hay) &&
      !/\bSP\d{4,}\b/i.test(hay) &&
      !DISCREPANCY.test(hay)
    ) {
      return "vendor_promises";
    }
    if (/\bSP\d{4,}\b/i.test(`${hay}\n${input.subject ?? ""}`)) {
      return "vendor_order_confirmation";
    }
    if (/\border confirmation\b/i.test(hay) && DISCREPANCY.test(hay)) {
      return "vendor_order_confirmation";
    }
    if (RN_JOB.test(input.subject ?? "") || RN_JOB.test(hay) || WORKSHOP.test(hay)) {
      return "workshop_started";
    }
    if (hasCadArtifact(input, hay)) return "vendor_delivers_artifact";
    if (CAD_FORTHCOMING.test(hay) && !ARTIFACT_DELIVERED.test(hay)) return "vendor_promises";
    const ownOnly = folded(authorOwnedText(input.authorOwnedText) || input.authorOwnedText);
    if (SHIPPING.test(hay)) return "unknown_communication";
    if (ownOnly && VENDOR_ACK.test(ownOnly) && !REQUEST.test(ownOnly)) {
      return "vendor_acknowledges";
    }
    if (!ownOnly && !files && !input.hasAttachments) return "vendor_acknowledges";
    if (!hasCadArtifact(input, hay) && !REQUEST.test(hay) && !DISCREPANCY.test(hay) && !SHIPPING.test(hay)) {
      return "vendor_acknowledges";
    }
    return "unknown_communication";
  }

  if (actor === "client") {
    if (CLIENT_APPROVES.test(hay)) return "client_approves";
    if (SHIPPING.test(hay) || REQUEST.test(hay)) return "client_requests";
    return "client_replies_nonblocking";
  }

  if (actor === "founder" || outbound) {
    if (FOUNDER_FULFILL.test(hay)) return "founder_fulfills_commitment";
    if (FOUNDER_PRINT_PLAN.test(hay) && !REQUEST.test(hay) && !vendorShopThread(input.subject)) {
      return "unknown_communication";
    }
    if (FOUNDER_CLIENT_UPDATE.test(hay) && !FOUNDER_VENDOR_INSTRUCTION.test(hay)) {
      return "founder_updates_client";
    }
    if (FOUNDER_VENDOR_INSTRUCTION.test(hay) || REQUEST.test(hay)) {
      return "founder_requests_vendor";
    }
    if (vendorShopThread(input.subject) && (input.hasAttachments === true || files.length > 0)) {
      return "founder_requests_vendor";
    }
    if (input.hasAttachments && !REQUEST.test(hay) && !vendorShopThread(input.subject)) {
      return "founder_fulfills_commitment";
    }
    return "unknown_communication";
  }

  if (actor === "system") return "unknown_communication";
  return "unknown_communication";
}
