/**
 * Concierge conversational copy + summary helpers.
 * Presentation language only — payload field names/values stay stable.
 */

export const CONCIERGE_FORM_FIELD_NAMES = {
  projectType: "projectType",
  shapeInterest: "shapeInterest",
  designDirection: "designDirection",
  ringPresence: "ringPresence",
  timeline: "timeline",
  budgetRange: "budgetRange",
  preferredContactMethod: "preferredContactMethod",
  fullName: "fullName",
  email: "email",
  phone: "phone",
  inspirationNotes: "inspirationNotes",
  submissionId: "submissionId",
} as const;

export const CONCIERGE_OPTION_VALUES = {
  projectTypes: [
    "Engagement Ring",
    "Custom Jewelry",
    "Wedding Band",
    "Still Exploring",
  ],
  shapes: [
    "Round",
    "Oval",
    "Radiant",
    "Cushion",
    "Emerald",
    "Pear",
    "Marquise",
    "Not Sure Yet",
  ],
  directions: [
    "Quiet Elegance",
    "Modern Minimal",
    "Classic Timeless",
    "Bold Presence",
    "Still Discovering",
  ],
  presences: ["Understated", "Balanced", "Statement", "Still Exploring"],
  timelines: ["0–2 months", "3–4 months", "6+ months", "Flexible"],
  budgets: [
    "Under 10k",
    "10–20k",
    "20–30k",
    "30–50k",
    "50k+",
    "Prefer to Discuss",
  ],
  preferredContacts: ["Email", "Phone", "Text", "Any Is Fine"],
} as const;

export const CONCIERGE_CTA_LABEL = "Begin the Conversation";

export const CONCIERGE_VISIBLE_COPY = {
  hero: {
    eyebrow: "Concierge",
    title: "A better place to begin.",
    body: "You may already know exactly what you are looking for—or simply have a sense of how it should feel. Either is enough to begin a thoughtful conversation about rings, diamonds, and custom design.",
    followUpPrefix:
      "Justin personally reads and responds to every submission, usually within 24 hours. If you prefer email first, reach Justin at",
    reassurance:
      "Share as much or as little as feels helpful. You do not need to have everything figured out.",
  },
  whatHappensNext: {
    heading: "What happens next?",
    body: "Justin will personally review what you share and respond with the most useful next step—usually a thoughtful email, a few clarifying questions, or a brief conversation. No sales pressure. No obligation.",
  },
  opening: {
    sectionLabel: "Let’s Begin",
    sectionTitle: "A few easy questions will help us understand where you are.",
    projectType: "What brings you here today?",
    shapeInterest: "Have you started gravitating toward a particular shape?",
  },
  design: {
    sectionLabel: "Design Direction",
    sectionTitle: "The tone and direction that feel most natural.",
    designDirection: "When you picture the finished piece, what feels most natural?",
    ringPresence: "How do you imagine it catching the eye?",
    summaryLabel: "So Far",
  },
  practical: {
    sectionLabel: "A Few Practical Details",
    sectionTitle: "These help Justin give you a more useful response.",
    timeline: "Is there a date you are working toward?",
    timelineHelperEngagement:
      "A proposal date, trip, anniversary, or general timeframe is helpful.",
    budget: "Do you already have an investment range in mind?",
    budgetHelper:
      "This simply helps us recommend the right direction. It is not a commitment.",
    notes: "Tell us anything you would like Justin to know.",
    notesPlaceholder:
      "A ring she loved, a design idea, a date—or simply “I have no idea where to begin.”",
    notesPlaceholderLong:
      "A ring she loved, a Pinterest board, a design idea, a proposal date, something you definitely do not want—or simply “I have no idea where to begin.”",
    referenceImages:
      "Reference images can be shared securely after the initial conversation.",
    contact: "How should Justin reach you?",
    contactSupport: "Share the best way to continue the conversation.",
    preferredContact: "Preferred Contact",
  },
  closing: {
    primary:
      "You do not need to have everything figured out. This is simply a starting point.",
  },
  contextual: {
    stillExploring: "Perfect. That is often the best place to begin.",
    notSureYet:
      "No problem. Shape is much easier to understand when you can compare it visually.",
    preferToDiscuss:
      "Absolutely. We can talk through what makes sense without starting from a fixed number.",
  },
} as const;

/** Natural lowercase cores — avoid duplicated descriptors like "classic timeless". */
const DIRECTION_CORE: Record<string, string> = {
  "Quiet Elegance": "quiet, elegant",
  "Modern Minimal": "quiet, modern",
  "Classic Timeless": "quiet, classic",
  "Bold Presence": "bold",
};

const PRESENCE_CORE: Record<string, string> = {
  Understated: "understated",
  Balanced: "balanced",
  Statement: "statement",
};

const SELECTED_SUMMARY_BODY =
  "That gives Justin a useful starting point. Shape, proportions, and final details can be refined together.";

const UNCERTAIN_SUMMARY: ConciergeSummary = {
  heading: "You’re still exploring—and that is completely fine.",
  body: "Nothing you choose here locks you into anything. These answers simply help Justin understand what feels right and where the conversation should begin.",
};

export type ConciergeSummaryInput = {
  projectType: string;
  shape: string;
  direction: string;
  presence: string;
};

export type ConciergeSummary = {
  heading: string;
  body: string;
};

/**
 * Warm reflection of design direction / presence — never diagnostic or locking.
 * Project type and shape are intentionally omitted from selected-state sentences
 * to avoid mechanical lists; consider weaving them in only after editorial review.
 */
export function buildConciergeSummary(
  input: ConciergeSummaryInput,
): ConciergeSummary {
  const directionOpen = input.direction === "Still Discovering";
  const presenceOpen = input.presence === "Still Exploring";

  if (directionOpen && presenceOpen) {
    return UNCERTAIN_SUMMARY;
  }

  const directionCore = DIRECTION_CORE[input.direction];
  const presenceCore = PRESENCE_CORE[input.presence];

  let heading: string;

  if (directionCore && presenceCore) {
    heading = `You seem drawn toward a ${directionCore} design with a ${presenceCore} presence.`;
  } else if (directionCore) {
    heading = `You seem drawn toward ${directionCore} design.`;
  } else if (presenceCore) {
    heading = `You seem drawn toward a more ${presenceCore} presence.`;
  } else {
    return UNCERTAIN_SUMMARY;
  }

  return {
    heading,
    body: SELECTED_SUMMARY_BODY,
  };
}

export type ConciergeContextualField = "projectType" | "shape" | "budget";

/** Subtle post-selection reassurance — only for known low-pressure choices. */
export function contextualReassuranceForSelection(
  field: ConciergeContextualField,
  value: string,
): string | null {
  if (field === "projectType" && value === "Still Exploring") {
    return CONCIERGE_VISIBLE_COPY.contextual.stillExploring;
  }
  if (field === "shape" && value === "Not Sure Yet") {
    return CONCIERGE_VISIBLE_COPY.contextual.notSureYet;
  }
  if (field === "budget" && value === "Prefer to Discuss") {
    return CONCIERGE_VISIBLE_COPY.contextual.preferToDiscuss;
  }
  return null;
}
