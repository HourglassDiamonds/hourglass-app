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
