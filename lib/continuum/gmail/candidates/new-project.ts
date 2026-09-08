/**
 * Strong explicit new-project language from Gmail evidence.
 * Proposals only. Does not mint Projects or Open Jobs.
 */

import { clipMatchedText } from "@/lib/continuum/candidates/identity";

export const NEW_PROJECT_CONTEXT_TOPIC = "new_project" as const;
export const WAITING_ON_CLIENT_TOPIC = "waiting_on_client" as const;
export const GIFT_CONTEXT_TOPIC = "gift_context" as const;
export const DESIGN_BASIS_TOPIC = "design_basis" as const;
export const ATTACHMENT_FILENAME_TOPIC = "attachment_filename" as const;
export const PROPOSED_SPEC_TOPIC = "proposed_spec" as const;

export const EXPLICIT_NEW_PROJECT_RULE = "explicit_new_project_request" as const;

const REJECT =
  /\b(repair|resize|tracking number|unsubscribe|newsletter|looks great|looks awesome|please proceed|status update|still waiting on the same)\b/i;

const EXPLICIT_NEW_PROJECT = [
  /i(?:'d| would) like to work together again to create another (?:piece|necklace|pendant|ring|earrings?)/i,
  /reaching back out to ask about a new piece i(?:'d| would) like designed/i,
  /create another piece/i,
  /new piece i(?:'d| would) like designed/i,
  /i(?:'d| would) like (?:to )?(?:create|commission|design|make) (?:a |another )?(?:new )?(?:necklace|pendant|earrings?|bracelet|piece)/i,
  /(?:a pair of|matching) .{0,80}earrings/i,
  /based on the same .{0,80}(?:artwork|painting|design|ring)/i,
] as const;

export type NewProjectHit = {
  title: string;
  matchedText: string;
  ruleIds: readonly string[];
};

export function foldProposedTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function looksExplicitNewProjectRequest(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  const hit = EXPLICIT_NEW_PROJECT.some((pattern) => pattern.test(hay));
  if (!hit) return false;
  if (REJECT.test(hay) && !/\b(?:another piece|new piece|another necklace|another pendant)\b/i.test(hay)) {
    return false;
  }
  return true;
}

export function proposeNewProjectTitle(text: string): string {
  const hay = text.toLowerCase();
  const daggerPearl =
    /\bdagger\b/.test(hay) && /\bpearls?\b/.test(hay);
  const necklace = /\bnecklace\b/.test(hay) || /\bpendant\b/.test(hay);
  const earrings = /\bearrings?\b/.test(hay);
  const marquise = /\bmarquise\b/.test(hay);
  if (daggerPearl && necklace) return "Dagger & Pearls Pendant / Necklace";
  if (marquise && earrings) return "Matching Marquise Earrings";
  if (earrings) return "Custom Earrings";
  if (necklace) return "Custom Necklace / Pendant";
  return "New custom piece";
}

export function extractNewProject(text: string): NewProjectHit[] {
  if (!looksExplicitNewProjectRequest(text)) return [];
  const matched =
    EXPLICIT_NEW_PROJECT.map((pattern) => {
      const re = new RegExp(pattern.source, pattern.flags);
      return re.exec(text)?.[0] ?? null;
    }).find((row) => row) ?? text.slice(0, 80);
  return [
    {
      title: proposeNewProjectTitle(text),
      matchedText: clipMatchedText(matched),
      ruleIds: [EXPLICIT_NEW_PROJECT_RULE],
    },
  ];
}

export type ContextProposal = {
  topic: string;
  value: string;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractNewProjectContexts(text: string): ContextProposal[] {
  const hits: ContextProposal[] = [];
  const gift = text.match(
    /\b(?:gift|present)\s+for\s+(?:my\s+)?(wife|husband|partner|fiancée|fiancee|mom|mother|dad|father)\b/i,
  );
  if (gift) {
    hits.push({
      topic: GIFT_CONTEXT_TOPIC,
      value: `gift for ${gift[1]!.toLowerCase()}`,
      matchedText: clipMatchedText(gift[0]),
      ruleIds: ["explicit_gift_context"],
    });
  }
  const basis = text.match(
    /\b(?:based on|same)\b[^.!\n]{0,120}(?:artwork|painting|design|dagger[^.!\n]{0,40}pearls?)/i,
  );
  if (basis) {
    hits.push({
      topic: DESIGN_BASIS_TOPIC,
      value: clipMatchedText(basis[0], 200),
      matchedText: clipMatchedText(basis[0]),
      ruleIds: ["explicit_design_basis"],
    });
  }
  const specs: Array<{ re: RegExp; value: string; rule: string }> = [
    {
      re: /\b(?:pair of|two|2)\s+marquise\b[^.!\n]{0,80}(?:lab[- ]grown)?/i,
      value: "2 marquise lab-grown diamonds",
      rule: "explicit_proposed_spec_shape",
    },
    {
      re: /\b(?:approximately|about|approx\.?|~)?\s*1\s*(?:ct|carat)\s*(?:each)?/i,
      value: "approximately 1 ct each",
      rule: "explicit_proposed_spec_carat",
    },
    {
      re: /\b(?:locking|secure|locking\/secure)\s+(?:back|backs)\b/i,
      value: "locking/secure back",
      rule: "explicit_proposed_spec_back",
    },
    {
      re: /\b(?:flower|floral)\s+(?:detail|center|centre)\b/i,
      value: "possible flower detail",
      rule: "explicit_proposed_spec_flower",
    },
    {
      re: /\bsimilar quality(?:\/|\s+and\s+)?brightness\b/i,
      value: "similar quality/brightness",
      rule: "explicit_proposed_spec_quality",
    },
  ];
  for (const spec of specs) {
    const match = text.match(spec.re);
    if (!match) continue;
    hits.push({
      topic: PROPOSED_SPEC_TOPIC,
      value: spec.value,
      matchedText: clipMatchedText(match[0]),
      ruleIds: [spec.rule],
    });
  }
  return hits;
}

export function extractWaitingOnClient(text: string): ContextProposal | null {
  const hay = text.trim();
  if (!hay) return null;
  const choice =
    /\?/.test(hay) ||
    /\b(?:or|would you|let me know|prefer|rather)\b/i.test(hay);
  if (!choice) return null;
  return {
    topic: WAITING_ON_CLIENT_TOPIC,
    value: clipMatchedText(hay, 200),
    matchedText: clipMatchedText(hay),
    ruleIds: ["outgoing_waiting_on_client"],
  };
}

export function isNewProjectContextPayload(payload: {
  kind: string;
  topic?: string;
}): boolean {
  return payload.kind === "project_context" && payload.topic === NEW_PROJECT_CONTEXT_TOPIC;
}
