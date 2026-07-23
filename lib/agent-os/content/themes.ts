/**
 * Founder message territories and planned conversation pipeline.
 * Static repository strategy inventory — not measured social performance.
 *
 * Themes preserve existing Hourglass positioning from Conversations + flywheel docs.
 */

export type MessageTerritory = {
  id: string;
  label: string;
  summary: string;
  coveredByEpisodeSlugs: string[];
};

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
};

/** Message territories already introduced or planned in the Hourglass content system. */
export const MESSAGE_TERRITORIES: MessageTerritory[] = [
  {
    id: "why-hourglass-exists",
    label: "Why Hourglass exists",
    summary: "Slower, discerning guidance in a faster diamond market.",
    coveredByEpisodeSlugs: ["why-we-re-here"],
  },
  {
    id: "options-vs-clarity",
    label: "More options do not make buying easier",
    summary: "Access expanded; judgment did not automatically follow.",
    coveredByEpisodeSlugs: ["why-we-re-here"],
  },
  {
    id: "luxury-retail-backwards",
    label: "Luxury retail feels backwards",
    summary: "Inspection of the client instead of standards on the product.",
    coveredByEpisodeSlugs: [],
  },
  {
    id: "client-not-inspected",
    label: "The client should not feel inspected",
    summary: "Warmth and guidance without pressure or gatekeeping the buyer.",
    coveredByEpisodeSlugs: [],
  },
  {
    id: "standard-on-product",
    label: "The standard belongs on the product",
    summary: "Selectivity about diamonds and design — not about who Hourglass helps.",
    coveredByEpisodeSlugs: [],
  },
  {
    id: "not-every-diamond",
    label: "Not every diamond deserves the spotlight",
    summary: "Discernment over inventory theater.",
    coveredByEpisodeSlugs: [],
  },
  {
    id: "analog-engagement",
    label: "Analog engagement moments",
    summary: "Physical world decisions in a fast digital buying environment.",
    coveredByEpisodeSlugs: ["why-we-re-here"],
  },
  {
    id: "tech-serves-humanity",
    label: "Technology serves humanity",
    summary: "Studios sharpen judgment; technology is not the hero.",
    coveredByEpisodeSlugs: ["why-we-re-here"],
  },
];

/**
 * Planned founder-conversation pipeline (strategic map level).
 * Not a publish schedule and not social performance evidence.
 */
export const PLANNED_CONVERSATION_TOPICS: PlannedConversationTopic[] = [
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
  },
];
