/**
 * Curated question universe for AI Fan-Out Coverage Analyzer.
 * V1 seeds + V1.1 expansion — canonical intents, not wording inflation.
 */

import { buildFanOutSeedQuestion, type SeedDraft } from "./seed-builder";
import { V11_EXPANSION_DRAFTS } from "./seed-v11-expansion";
import {
  QUERY_FAMILIES,
  type FanOutQuestion,
  type QueryFamily,
} from "./types";

function q(draft: SeedDraft): FanOutQuestion {
  return buildFanOutSeedQuestion(draft);
}

/**
 * V1 curated seed set (~44 active + 1 intentional duplicate).
 * V1.1 expansion is appended via V11_EXPANSION_DRAFTS.
 */
const SEED_DRAFTS_V1: SeedDraft[] = [
  // beginner-education
  {
    question: "What should I know before buying an engagement ring?",
    family: "beginner-education",
    intent: "informational",
    stage: "discovering",
    commercial: 7,
    authority: 8,
    matchTerms: ["before buying", "engagement ring", "buying tips", "beginner"],
    entities: ["engagement-ring"],
    topics: ["buying-guides", "education"],
  },
  {
    question: "What are the Four Cs and which matter most?",
    family: "beginner-education",
    intent: "informational",
    stage: "researching",
    commercial: 6,
    authority: 7,
    matchTerms: ["four cs", "cut", "color", "clarity", "carat", "most important"],
    entities: ["four-cs"],
    topics: ["education", "cut"],
  },
  {
    question: "Do I need to see a diamond in person?",
    family: "beginner-education",
    intent: "informational",
    stage: "comparing",
    commercial: 8,
    authority: 8,
    matchTerms: [
      "see in person",
      "in person",
      "view diamond",
      "appointment",
      "private appointment",
      "showroom",
      "side by side",
    ],
    entities: ["private-appointment"],
    topics: ["buying-process", "trust", "private-client"],
  },

  // diamond-quality
  {
    question: "Why can two diamonds with the same grade look different?",
    family: "diamond-quality",
    intent: "informational",
    stage: "researching",
    commercial: 8,
    authority: 10,
    matchTerms: ["same grade", "look different", "grades", "performance", "triple excellent"],
    entities: ["grading", "light-performance"],
    topics: ["quality", "cut", "certification"],
  },
  {
    question: "Is GIA Triple Excellent always enough?",
    family: "diamond-quality",
    intent: "informational",
    stage: "comparing",
    commercial: 8,
    authority: 10,
    matchTerms: [
      "triple excellent",
      "excellent grades",
      "excellent cut",
      "still aren't recommended",
      "paper grades",
      "optical performance",
      "gia",
    ],
    entities: ["gia", "cut-grade", "selection-philosophy"],
    topics: ["cut", "certification", "quality", "approach"],
  },
  {
    question: "Is fluorescence bad in a diamond?",
    family: "diamond-quality",
    intent: "informational",
    stage: "researching",
    commercial: 6,
    authority: 8,
    matchTerms: ["fluorescence", "bad", "hazy", "good or bad"],
    entities: ["fluorescence"],
    topics: ["color", "fluorescence"],
  },
  {
    question: "What does a Graduate Gemologist actually do?",
    family: "diamond-quality",
    intent: "informational",
    stage: "comparing",
    commercial: 9,
    authority: 10,
    matchTerms: ["graduate gemologist", "gemologist", "evaluate", "grading report"],
    entities: ["graduate-gemologist", "justin-smith"],
    topics: ["expertise", "trust"],
  },
  {
    question: "How do jewelers choose which diamonds to reject?",
    family: "diamond-quality",
    intent: "informational",
    stage: "researching",
    commercial: 7,
    authority: 10,
    matchTerms: ["reject", "selection", "curated", "wouldnt buy", "recommend"],
    entities: ["selection-philosophy"],
    topics: ["quality", "trust", "approach"],
  },

  // cut-and-sparkle
  {
    question: "What makes one diamond sparkle more than another?",
    family: "cut-and-sparkle",
    intent: "informational",
    stage: "researching",
    commercial: 8,
    authority: 10,
    matchTerms: ["sparkle", "light performance", "brilliance", "cut affects"],
    entities: ["sparkle", "cut", "light-performance"],
    topics: ["cut", "light-performance"],
  },
  {
    question: "Is cut the most important of the Four Cs?",
    family: "cut-and-sparkle",
    intent: "informational",
    stage: "researching",
    commercial: 7,
    authority: 9,
    matchTerms: ["cut", "most important", "four cs", "sparkle"],
    entities: ["cut"],
    topics: ["cut"],
  },
  {
    question: "Why can two Excellent cut diamonds look different?",
    family: "cut-and-sparkle",
    intent: "informational",
    stage: "comparing",
    commercial: 8,
    authority: 10,
    matchTerms: ["excellent cut", "look different", "proportions", "light return"],
    entities: ["cut-grade", "light-performance"],
    topics: ["cut", "quality"],
  },

  // natural-versus-lab
  {
    question: "Should I buy a natural or lab-grown diamond?",
    family: "natural-versus-lab",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 9,
    matchTerms: ["natural", "lab-grown", "lab grown", "lab diamonds", "origin"],
    entities: ["natural-diamond", "lab-grown"],
    topics: ["natural-vs-lab"],
  },
  {
    question: "Are lab-grown diamonds real diamonds?",
    family: "natural-versus-lab",
    intent: "informational",
    stage: "discovering",
    commercial: 7,
    authority: 8,
    matchTerms: ["lab-grown", "real diamonds", "crystalline"],
    entities: ["lab-grown"],
    topics: ["natural-vs-lab"],
  },
  {
    question: "Which holds value better, natural or lab-grown diamonds?",
    family: "natural-versus-lab",
    intent: "commercial",
    stage: "comparing",
    commercial: 8,
    authority: 7,
    matchTerms: ["holds value", "resale", "natural", "lab-grown"],
    entities: ["natural-diamond", "lab-grown"],
    topics: ["natural-vs-lab", "pricing"],
  },

  // shapes-and-appearance
  {
    question: "Which diamond shape looks largest?",
    family: "shapes-and-appearance",
    intent: "informational",
    stage: "comparing",
    commercial: 8,
    authority: 8,
    matchTerms: ["shape looks", "largest", "look bigger", "elongated"],
    entities: ["diamond-shape", "face-up-size"],
    topics: ["shapes", "size"],
  },
  {
    question: "What is the difference between cut and shape?",
    family: "shapes-and-appearance",
    intent: "informational",
    stage: "discovering",
    commercial: 5,
    authority: 7,
    matchTerms: ["cut vs", "cut and shape", "difference between cut"],
    entities: ["cut", "shape"],
    topics: ["shapes", "cut"],
  },
  {
    question: "How big does a 1 carat diamond look on the hand?",
    family: "shapes-and-appearance",
    intent: "informational",
    stage: "researching",
    commercial: 7,
    authority: 7,
    matchTerms: ["1 carat", "on hand", "size on hand", "how big"],
    entities: ["carat", "on-hand"],
    topics: ["size"],
  },

  // pricing-and-budgeting
  {
    question: "How much should I spend on an engagement ring?",
    family: "pricing-and-budgeting",
    intent: "commercial",
    stage: "discovering",
    commercial: 10,
    authority: 7,
    matchTerms: [
      "how much",
      "spend",
      "budget",
      "price vs quality",
      "diamond price",
      "priorities",
      "timeline and budget",
    ],
    entities: ["budget", "engagement-ring"],
    topics: ["pricing", "buying-guides", "engagement-ring"],
  },
  {
    question: "How do diamond price and quality trade off?",
    family: "pricing-and-budgeting",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 8,
    matchTerms: ["price vs quality", "price", "quality", "budget"],
    entities: ["pricing"],
    topics: ["pricing"],
  },
  {
    question: "Is buying a diamond online risky?",
    family: "pricing-and-budgeting",
    intent: "commercial",
    stage: "comparing",
    commercial: 8,
    authority: 8,
    matchTerms: [
      "buying online",
      "online risky",
      "remote",
      "certificate",
      "grading report",
      "second opinion",
      "public inventory search",
      "comparison at scale",
    ],
    entities: ["online-purchase", "selection-philosophy"],
    topics: ["trust", "buying-process", "approach"],
  },

  // custom-design
  {
    question: "What is the advantage of a custom engagement ring?",
    family: "custom-design",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 9,
    matchTerms: ["custom engagement", "custom ring", "advantage", "private design"],
    entities: ["custom-design"],
    topics: ["custom-design"],
  },
  {
    question: "How long does custom ring design take?",
    family: "custom-design",
    intent: "commercial",
    stage: "selecting",
    commercial: 8,
    authority: 7,
    matchTerms: ["how long", "custom", "timeline", "design take", "process"],
    entities: ["custom-design", "timeline"],
    topics: ["custom-design", "buying-process"],
  },
  {
    question: "How does the custom engagement ring process work?",
    family: "custom-design",
    intent: "commercial",
    stage: "ready-to-contact",
    commercial: 9,
    authority: 8,
    matchTerms: ["custom engagement", "process work", "private design", "sourcing"],
    entities: ["custom-design", "concierge"],
    topics: ["custom-design"],
  },

  // buying-process-anxiety
  {
    question: "How do I choose a ring without ruining the surprise?",
    family: "buying-process-anxiety",
    intent: "informational",
    stage: "selecting",
    commercial: 9,
    authority: 8,
    matchTerms: ["surprise", "without ruining", "secret", "proposal"],
    entities: ["proposal", "surprise"],
    topics: ["proposal", "buying-process"],
  },
  {
    question: "What happens after I contact a concierge jeweler?",
    family: "buying-process-anxiety",
    intent: "commercial",
    stage: "ready-to-contact",
    commercial: 10,
    authority: 8,
    matchTerms: ["after i contact", "concierge", "what happens", "conversation"],
    entities: ["concierge"],
    topics: ["buying-process", "concierge"],
  },
  {
    question: "How can I tell whether a jeweler is trustworthy?",
    family: "buying-process-anxiety",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 10,
    matchTerms: ["trustworthy", "trust", "jeweler", "pressure", "honest"],
    entities: ["trust"],
    topics: ["trust", "jeweler-comparison"],
  },

  // proposal-and-surprise
  {
    question: "How do I plan a proposal she will never forget?",
    family: "proposal-and-surprise",
    intent: "informational",
    stage: "selecting",
    commercial: 7,
    authority: 6,
    matchTerms: ["plan a proposal", "never forget", "proposal"],
    entities: ["proposal"],
    topics: ["proposal"],
  },
  {
    question: "Where are the best places to propose in Charlotte?",
    family: "proposal-and-surprise",
    intent: "local",
    stage: "selecting",
    geography: "charlotte",
    commercial: 6,
    authority: 6,
    matchTerms: ["propose in charlotte", "places to propose", "charlotte proposal"],
    entities: ["charlotte", "proposal"],
    topics: ["proposal", "local"],
  },

  // luxury-and-private-client
  {
    question: "Is a private jeweler better than a chain?",
    family: "luxury-and-private-client",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 9,
    matchTerms: ["private jeweler", "chain", "independent", "jewelry store", "advisor"],
    entities: ["private-jeweler"],
    topics: ["private-client", "jeweler-comparison"],
  },
  {
    question: "What does private engagement ring design mean?",
    family: "luxury-and-private-client",
    intent: "commercial",
    stage: "researching",
    commercial: 8,
    authority: 8,
    matchTerms: ["private engagement", "private design", "appointment"],
    entities: ["private-design"],
    topics: ["private-client", "custom-design"],
  },
  {
    question: "Why work with an independent diamond advisor?",
    family: "luxury-and-private-client",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 9,
    matchTerms: ["independent", "diamond advisor", "vs jewelry store", "inventory"],
    entities: ["diamond-advisor"],
    topics: ["private-client", "jeweler-comparison"],
  },

  // local-charlotte-intent
  {
    question: "What should I look for in a Charlotte jeweler?",
    family: "local-charlotte-intent",
    intent: "local",
    stage: "comparing",
    geography: "charlotte",
    commercial: 9,
    authority: 9,
    matchTerms: ["charlotte jeweler", "look for", "charlotte", "advisor"],
    entities: ["charlotte"],
    topics: ["local", "trust"],
  },
  {
    question: "Who is the best engagement ring jeweler in Charlotte?",
    family: "local-charlotte-intent",
    intent: "local",
    stage: "ready-to-contact",
    geography: "charlotte",
    commercial: 10,
    authority: 8,
    matchTerms: ["best", "engagement ring", "jeweler", "charlotte"],
    entities: ["charlotte", "engagement-ring"],
    topics: ["local", "jeweler-comparison"],
  },
  {
    question: "Where should I buy an engagement ring near Waxhaw?",
    family: "local-charlotte-intent",
    intent: "local",
    stage: "ready-to-contact",
    geography: "waxhaw",
    commercial: 10,
    authority: 8,
    matchTerms: ["waxhaw", "near waxhaw", "engagement ring", "union county"],
    entities: ["waxhaw", "charlotte-metro"],
    topics: ["local"],
  },
  {
    question: "Does Hourglass serve Charlotte and surrounding areas?",
    family: "local-charlotte-intent",
    intent: "local",
    stage: "discovering",
    geography: "charlotte-metro",
    commercial: 8,
    authority: 7,
    matchTerms: ["serve charlotte", "waxhaw", "areas", "metro"],
    entities: ["charlotte", "waxhaw"],
    topics: ["local"],
  },

  // jeweler-comparison
  {
    question: "How is a private jeweler different from a traditional jewelry store?",
    family: "jeweler-comparison",
    intent: "commercial",
    stage: "comparing",
    commercial: 9,
    authority: 9,
    matchTerms: ["private jeweler", "traditional jewelry store", "inventory", "advisor"],
    entities: ["private-jeweler", "retail-store"],
    topics: ["jeweler-comparison"],
  },
  {
    question: "Should I buy from a big box jewelry retailer?",
    family: "jeweler-comparison",
    intent: "commercial",
    stage: "comparing",
    commercial: 7,
    authority: 7,
    matchTerms: ["big box", "retailer", "chain", "mall jeweler"],
    entities: ["retail-store"],
    topics: ["jeweler-comparison"],
  },

  // trust-ethics-credibility
  {
    question: "How can I verify a jeweler is trustworthy?",
    family: "trust-ethics-credibility",
    intent: "informational",
    stage: "comparing",
    commercial: 8,
    authority: 10,
    matchTerms: ["verify", "trustworthy", "credentials", "gemologist"],
    entities: ["trust", "graduate-gemologist"],
    topics: ["trust"],
    // Near-duplicate of buying-process trust question — marked for dedupe handling
    duplicateOf: "How can I tell whether a jeweler is trustworthy?",
    status: "duplicate",
  },
  {
    question: "Does Hourglass have a public showroom?",
    family: "trust-ethics-credibility",
    intent: "informational",
    stage: "discovering",
    commercial: 6,
    authority: 7,
    matchTerms: ["showroom", "public showroom", "appointment", "walk-in"],
    entities: ["private-appointment"],
    topics: ["trust", "private-client"],
  },
  {
    question: "Why don't you list thousands of diamonds online?",
    family: "trust-ethics-credibility",
    intent: "informational",
    stage: "researching",
    commercial: 6,
    authority: 9,
    matchTerms: ["thousands of diamonds", "list", "inventory", "curated selection"],
    entities: ["selection-philosophy"],
    topics: ["trust", "approach"],
  },

  // maintenance-repairs-ownership
  {
    question: "What happens in the first 30 days after you get engaged?",
    family: "maintenance-repairs-ownership",
    intent: "informational",
    stage: "post-purchase",
    commercial: 5,
    authority: 6,
    matchTerms: ["first 30 days", "after you get engaged", "after engagement"],
    entities: ["post-engagement"],
    topics: ["ownership", "proposal"],
  },
  {
    question: "How should I care for an engagement ring day to day?",
    family: "maintenance-repairs-ownership",
    intent: "informational",
    stage: "post-purchase",
    commercial: 4,
    authority: 6,
    matchTerms: ["care for", "maintenance", "clean", "repair", "ownership"],
    entities: ["ring-care"],
    topics: ["maintenance"],
  },
  {
    question: "Do lab-grown diamonds need different care than natural diamonds?",
    family: "maintenance-repairs-ownership",
    intent: "informational",
    stage: "post-purchase",
    commercial: 4,
    authority: 5,
    matchTerms: ["care", "lab-grown", "natural", "maintenance", "durability"],
    entities: ["lab-grown", "ring-care"],
    topics: ["maintenance", "natural-vs-lab"],
  },

  // Extra high-value seeds requested explicitly
  {
    question: "How does Hourglass source diamonds?",
    family: "buying-process-anxiety",
    intent: "commercial",
    stage: "researching",
    commercial: 8,
    authority: 9,
    matchTerms: ["source diamonds", "sourcing", "trade networks", "inventory"],
    entities: ["sourcing"],
    topics: ["buying-process", "trust"],
  },
  {
    question: "When is the best time to buy a diamond?",
    family: "pricing-and-budgeting",
    intent: "commercial",
    stage: "selecting",
    commercial: 7,
    authority: 6,
    matchTerms: ["best time to buy", "when to buy", "timing"],
    entities: ["timing"],
    topics: ["pricing", "buying-guides"],
  },
];

const SEED_DRAFTS: SeedDraft[] = [...SEED_DRAFTS_V1, ...V11_EXPANSION_DRAFTS];

export const FAN_OUT_SEED_QUESTIONS: FanOutQuestion[] = SEED_DRAFTS.map(q);

/** Target band for active canonical questions (V1.1). */
export const FAN_OUT_ACTIVE_CANONICAL_MIN = 125;
export const FAN_OUT_ACTIVE_CANONICAL_MAX = 175;

export function getActiveFanOutQuestions(
  questions: FanOutQuestion[] = FAN_OUT_SEED_QUESTIONS,
): FanOutQuestion[] {
  return questions.filter((item) => item.status === "active");
}

export function getFanOutQuestionsByStatus(
  status: FanOutQuestion["status"],
  questions: FanOutQuestion[] = FAN_OUT_SEED_QUESTIONS,
): FanOutQuestion[] {
  return questions.filter((item) => item.status === status);
}

export function validateQueryFamily(value: string): value is QueryFamily {
  return (QUERY_FAMILIES as readonly string[]).includes(value);
}

export function dedupeQuestionsByCanonicalText(
  questions: FanOutQuestion[],
): FanOutQuestion[] {
  const seen = new Map<string, FanOutQuestion>();
  const out: FanOutQuestion[] = [];
  for (const question of questions) {
    const key = question.canonicalQuestion
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, question);
      out.push(question);
      continue;
    }
    // Keep active over duplicate/deprecated/deferred/rejected
    if (existing.status !== "active" && question.status === "active") {
      const idx = out.indexOf(existing);
      out[idx] = question;
      seen.set(key, question);
    }
  }
  return out;
}
