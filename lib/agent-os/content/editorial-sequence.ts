/**
 * Canonical Hourglass editorial Conversation sequence — single source of truth.
 *
 * Status lanes (do not conflate):
 * - published: live Conversation episodes in `lib/conversations/episodes.ts`
 * - reserved: next approved Conversation cycles (founder-affirmed order)
 * - post-sequence: ROI-ranked packages after reserved cycles (Content ROI)
 * - reserve-backlog: older planned themes kept inspectable, not active sequence
 *
 * Search Strategy does not own this sequence; Content / ROI / inventory / CLI do.
 * Do not duplicate these titles elsewhere — import from this module.
 */

export type EditorialSequenceLane =
  | "published"
  | "reserved"
  | "post-sequence"
  | "reserve-backlog";

export type PlannedConversationTopic = {
  id: string;
  title: string;
  audienceQuestion: string;
  centralIdea: string;
  supportingIdeaAreas: string[];
  ownableLines: string[];
  relatedGuideSlug?: string;
  relatedToolPath?: string;
  funnelStage: "awareness" | "consideration" | "decision" | "trust";
  sequenceAfter?: string;
  carouselFriendly: boolean;
  clipFriendly: boolean;
  /** Paired A Matter of Taste title when this is a reserved Conversation cycle */
  pairedTasteTitle?: string;
  /** Lane for inventory / CLI / planning inspectability */
  sequenceLane: EditorialSequenceLane;
};

export type ReservedConversationCycle = {
  position: number;
  id: string;
  conversationTitle: string;
  tasteTitle: string;
  centralIdea: string;
  audienceQuestion: string;
  supportingIdeaAreas: string[];
  ownableLines: string[];
  relatedGuideSlug?: string;
  relatedToolPath?: string;
  funnelStage: PlannedConversationTopic["funnelStage"];
  sequenceAfter: string;
  carouselFriendly: boolean;
  clipFriendly: boolean;
  relatedQuestionMatchers: string[];
};

/**
 * Founder-affirmed next-three Conversation cycles.
 * New ROI-ranked topics begin AFTER these.
 */
export const RESERVED_CONVERSATION_CYCLES: ReservedConversationCycle[] = [
  {
    position: 1,
    id: "start-diamond-shopping-wrong-place",
    conversationTitle: "Most People Start Diamond Shopping in the Wrong Place",
    tasteTitle: "Why Diamonds Shouldn’t Sound Like Desserts",
    centralIdea:
      "Buyers often begin with carat, price lists, or retailer theater instead of judgment, standards, and how a diamond will actually look and feel.",
    audienceQuestion:
      "Where should I actually start when shopping for an engagement ring?",
    supportingIdeaAreas: [
      "Why carat-first and price-list-first shopping misleads",
      "What judgment and standards look like in practice",
      "How Hourglass reorders the buying path without inventory theater",
    ],
    ownableLines: [
      "Most people start in the wrong place — and then wonder why every diamond looks the same.",
    ],
    relatedGuideSlug: "independent-diamond-advisor-vs-jewelry-store",
    relatedToolPath: "/diamond-intelligence",
    funnelStage: "consideration",
    sequenceAfter: "why-we-re-here",
    carouselFriendly: true,
    clipFriendly: true,
    relatedQuestionMatchers: [
      "what should i know before buying an engagement ring",
      "should i buy a diamond online or from a local jeweler",
      "is buying a diamond online risky",
      "how can i tell whether a jeweler is trustworthy",
      "most people start",
      "wrong place",
    ],
  },
  {
    position: 2,
    id: "identical-diamonds-look-different",
    conversationTitle:
      "Why Two Identical Diamonds Can Look Completely Different",
    tasteTitle: "When Everything Is “Rare,” Nothing Is",
    centralIdea:
      "Certificate sameness hides cut, light performance, and selection standards that determine what the eye actually sees.",
    audienceQuestion:
      "Why can two diamonds with the same grades look so different in person?",
    supportingIdeaAreas: [
      "What certificates measure — and what they miss",
      "Cut and light performance beyond paper grades",
      "How discernment selects between “identical” options",
    ],
    ownableLines: [
      "Identical on paper is not identical to the eye.",
    ],
    relatedGuideSlug: "what-is-diamond-cut",
    relatedToolPath: "/diamond-studio",
    funnelStage: "consideration",
    sequenceAfter: "start-diamond-shopping-wrong-place",
    carouselFriendly: true,
    clipFriendly: true,
    relatedQuestionMatchers: [
      "why do two diamonds that look identical have different prices",
      "why can two diamonds with the same grade look different",
      "how can i inspect diamond cut quality beyond the certificate",
      "identical diamonds",
      "look completely different",
      "cut quality beyond",
    ],
  },
  {
    position: 3,
    id: "confidence-to-stop-looking",
    conversationTitle: "The Confidence to Stop Looking",
    tasteTitle: "Lab vs Natural Is Six of One, Half a Dozen of the Other",
    centralIdea:
      "Endless comparison is a trap; discernment ends when standards are clear and the right stone is recognized.",
    audienceQuestion:
      "How do I know when I’ve found the right diamond and can stop comparing?",
    supportingIdeaAreas: [
      "When more research stops improving the decision",
      "Standards that make “enough” feel clear",
      "Lab vs natural as preference — not a moral panic",
    ],
    ownableLines: [
      "Confidence is knowing when to stop looking.",
    ],
    relatedGuideSlug: "natural-vs-lab-diamonds",
    relatedToolPath: "/concierge",
    funnelStage: "decision",
    sequenceAfter: "identical-diamonds-look-different",
    carouselFriendly: true,
    clipFriendly: true,
    relatedQuestionMatchers: [
      "confidence to stop looking",
      "when should i stop comparing diamonds and just decide",
      "when is enough research enough",
      "how do i know i found the right diamond",
    ],
  },
];

/** Active planned pipeline = reserved cycles only (canonical). */
export const PLANNED_CONVERSATION_TOPICS: PlannedConversationTopic[] =
  RESERVED_CONVERSATION_CYCLES.map((cycle) => ({
    id: cycle.id,
    title: cycle.conversationTitle,
    audienceQuestion: cycle.audienceQuestion,
    centralIdea: cycle.centralIdea,
    supportingIdeaAreas: cycle.supportingIdeaAreas,
    ownableLines: cycle.ownableLines,
    relatedGuideSlug: cycle.relatedGuideSlug,
    relatedToolPath: cycle.relatedToolPath,
    funnelStage: cycle.funnelStage,
    sequenceAfter: cycle.sequenceAfter,
    carouselFriendly: cycle.carouselFriendly,
    clipFriendly: cycle.clipFriendly,
    pairedTasteTitle: cycle.tasteTitle,
    sequenceLane: "reserved" as const,
  }));

/**
 * Older planned themes preserved as reserve-backlog candidates.
 * Inspectable for future ROI consideration — not part of the active reserved sequence.
 */
export const RESERVE_BACKLOG_CONVERSATION_TOPICS: PlannedConversationTopic[] = [
  {
    id: "options-without-clarity",
    title: "Why more diamond options do not make buying easier",
    audienceQuestion:
      "If I can see thousands of diamonds online, why does choosing still feel harder?",
    centralIdea:
      "Access without standards creates noise. Hourglass exists to restore judgment — not to add another catalog.",
    supportingIdeaAreas: [
      "What expanded inventory actually changed",
      "Where buyers get stuck between labs, listings, and aesthetics",
      "How discernment differs from ‘more filters’",
      "When a Studio tool clarifies without replacing a conversation",
    ],
    ownableLines: [
      "We don’t sell inventory. We sell discernment.",
      "Technology can sharpen judgment. It should never replace it.",
    ],
    relatedGuideSlug: "natural-vs-lab-diamonds",
    relatedToolPath: "/diamond-intelligence",
    funnelStage: "consideration",
    sequenceAfter: "why-we-re-here",
    carouselFriendly: true,
    clipFriendly: true,
    sequenceLane: "reserve-backlog",
  },
  {
    id: "standard-belongs-on-product",
    title: "The standard belongs on the product — not on the client",
    audienceQuestion:
      "Why does buying a diamond often feel like being evaluated instead of being guided?",
    centralIdea:
      "Quiet luxury means selectivity about stones and craft, never about whether someone ‘belongs’ in the room.",
    supportingIdeaAreas: [
      "How retail inspection culture feels to buyers",
      "What product standards look like in practice",
      "Warmth without lowering the bar on cut and design",
    ],
    ownableLines: [
      "Selectivity belongs on the product, not the person.",
    ],
    relatedGuideSlug: "what-is-diamond-cut",
    relatedToolPath: "/diamond-studio",
    funnelStage: "trust",
    sequenceAfter: "options-without-clarity",
    carouselFriendly: true,
    clipFriendly: true,
    sequenceLane: "reserve-backlog",
  },
  {
    id: "charlotte-discernment",
    title: "What thoughtful diamond buying looks like in Charlotte",
    audienceQuestion:
      "Where do Charlotte couples go when they want calm guidance instead of showroom pressure?",
    centralIdea:
      "Local authority is earned through clarity and craft — not by inventing GBP metrics Hourglass cannot verify yet.",
    supportingIdeaAreas: [
      "Regional discovery intent without fear-based local SEO",
      "How Concierge and Studios support in-person judgment",
      "Quiet luxury for South Charlotte / Waxhaw / Fort Mill seekers",
    ],
    ownableLines: [
      "Guidance should feel personal — even when the research starts online.",
    ],
    relatedGuideSlug: "charlotte-diamond-advisor-guide",
    relatedToolPath: "/concierge",
    funnelStage: "decision",
    sequenceAfter: "standard-belongs-on-product",
    carouselFriendly: false,
    clipFriendly: true,
    sequenceLane: "reserve-backlog",
  },
];

export function getCanonicalReservedSequenceTitles(): string[] {
  return RESERVED_CONVERSATION_CYCLES.map((c) => c.conversationTitle);
}

export function getCanonicalReservedTasteTitles(): string[] {
  return RESERVED_CONVERSATION_CYCLES.map((c) => c.tasteTitle);
}
