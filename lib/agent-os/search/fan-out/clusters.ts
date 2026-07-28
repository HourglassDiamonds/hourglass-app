/**
 * Gap-cluster definitions — consolidate overlapping buyer questions into
 * flagship resources + supporting FAQs instead of competing thin pages.
 */

import { normalizeText } from "./normalize";

export type GapClusterDefinition = {
  id: string;
  flagshipTitle: string;
  /** Prefer expanding this page when present; otherwise create flagship guide */
  preferredExistingPages: string[];
  /** Normalized question substrings / exact canonical questions in the cluster */
  questionMatchers: string[];
};

export const GAP_CLUSTER_DEFINITIONS: GapClusterDefinition[] = [
  {
    id: "buyer-orientation-where-to-buy",
    flagshipTitle: "How to Choose Where to Buy an Engagement Ring",
    preferredExistingPages: [
      "/engagement-rings",
      "/diamond-guide/independent-diamond-advisor-vs-jewelry-store",
      "/diamond-guide/charlotte-diamond-advisor-guide",
      "/our-approach",
    ],
    questionMatchers: [
      "is buying a diamond online risky",
      "should i buy from a big box jewelry retailer",
      "how can i tell whether a jeweler is trustworthy",
      "do i need to see a diamond in person",
      "what should i know before buying an engagement ring",
      "should i buy a diamond online or from a local jeweler",
      "what are warning signs of an untrustworthy jeweler",
      "is it better to buy locally in charlotte or online",
      "what is the difference between an inventory seller and a sourcing advisor",
    ],
  },
  {
    id: "pricing-budget-tradeoffs",
    flagshipTitle: "How to Budget for an Engagement Ring Without Guesswork",
    preferredExistingPages: [
      "/diamond-guide",
      "/engagement-rings",
      "/our-approach",
    ],
    questionMatchers: [
      "how much should i spend on an engagement ring",
      "how do diamond price and quality trade off",
      "how should i split my budget between the setting and the diamond",
      "at what price point does spending more actually improve how a diamond looks",
      "is there a point where paying more stops making a visible difference",
      "should i prioritize carat size or diamond quality on a fixed budget",
      "why do two diamonds that look identical have different prices",
      "what am i paying for beyond the diamond itself when i work with a jeweler",
      "how is pricing determined for a custom engagement ring",
    ],
  },
  {
    id: "ownership-care-maintenance",
    flagshipTitle: "How to Care for an Engagement Ring After the Proposal",
    preferredExistingPages: [
      "/diamond-guide",
      "/engagement-rings",
      "/our-approach",
    ],
    questionMatchers: [
      "how should i care for an engagement ring day to day",
      "how often should i get my engagement ring professionally cleaned",
      "how often should prongs be checked for a loose diamond",
      "what is the difference between a jewelers warranty and ring insurance",
      "when should i take off my engagement ring",
      "do i need insurance for an engagement ring",
      "is it safe to wear my engagement ring to the gym pool or beach",
      "what happens in the first 30 days after you get engaged",
    ],
  },
];

export function resolveGapClusterId(canonicalQuestion: string): string | null {
  const n = normalizeText(canonicalQuestion);
  for (const cluster of GAP_CLUSTER_DEFINITIONS) {
    if (cluster.questionMatchers.some((m) => n === m || n.includes(m))) {
      return cluster.id;
    }
  }
  return null;
}

export function getGapClusterDefinition(
  clusterId: string,
): GapClusterDefinition | undefined {
  return GAP_CLUSTER_DEFINITIONS.find((c) => c.id === clusterId);
}
