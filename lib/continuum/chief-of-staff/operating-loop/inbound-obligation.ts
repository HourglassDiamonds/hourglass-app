/**
 * Deterministic inbound obligation copy for Today.
 * Uses matched ask tokens only. Does not call Sol for chronology.
 */

export type InboundObligation = {
  headline: string;
  explanation: string;
};

function firstName(label: string | null | undefined): string | null {
  const token = (label ?? "").trim().split(/\s+/)[0] ?? "";
  if (!token || token.toLowerCase() === "unassigned") return null;
  return token;
}

function who(label: string | null | undefined): string {
  return firstName(label) ?? "They";
}

export function extractInboundObligation(
  text: string,
  personLabel?: string | null,
): InboundObligation | null {
  const hay = text.replace(/\s+/g, " ").trim();
  if (!hay) return null;
  const lower = hay.toLowerCase();
  const pearl = /\bpearls?\b/.test(lower);
  const platinumBead = /\bplatinum\b/.test(lower) && /\bbead/.test(lower);
  const cost = /\b(cost|price|pricing|estimated)\b/.test(lower);
  const chain = /\bchain\b/.test(lower);
  const media = /\b(pictures?|photos?|videos?)\b/.test(lower);
  const actor = who(personLabel);

  if (pearl && platinumBead && cost && chain) {
    return {
      headline: "Price pearl vs platinum beadwork and send chain options.",
      explanation: `${actor} wants the cost difference between pearl and platinum beadwork, plus photos/video and pricing for chain options.`,
    };
  }
  if (pearl && platinumBead && cost) {
    return {
      headline: "Price pearl vs platinum beadwork.",
      explanation: `${actor} wants the cost difference between pearl and platinum beadwork.`,
    };
  }
  if (chain && (media || cost) && /\b(option|options|send|pricing)\b/.test(lower)) {
    return {
      headline: "Send chain options and pricing.",
      explanation: `${actor} asked for chain options${media ? ", photos/video," : ""} and pricing.`,
    };
  }
  return null;
}
