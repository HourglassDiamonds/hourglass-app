/**
 * Founder message territories and planned conversation pipeline.
 * Static repository strategy inventory — not measured social performance.
 *
 * Canonical Conversation sequence lives in `editorial-sequence.ts`.
 * This module re-exports that sequence and preserves message territories.
 */

export type { PlannedConversationTopic, EditorialSequenceLane } from "./editorial-sequence";

export {
  RESERVED_CONVERSATION_CYCLES,
  PLANNED_CONVERSATION_TOPICS,
  RESERVE_BACKLOG_CONVERSATION_TOPICS,
  getCanonicalReservedSequenceTitles,
  getCanonicalReservedTasteTitles,
} from "./editorial-sequence";

export type MessageTerritory = {
  id: string;
  label: string;
  summary: string;
  coveredByEpisodeSlugs: string[];
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
