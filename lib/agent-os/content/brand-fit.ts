/**
 * Brand-fit safeguards for Content recommendations.
 * Quiet luxury: calm, credible, no clickbait or commodity selling.
 */

const REJECT_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\byou won'?t believe\b/i, reason: "Clickbait framing" },
  { re: /\bshocking\b|\bmind-?blowing\b/i, reason: "Exaggerated hook language" },
  { re: /\bhack\b|\bsecret trick\b/i, reason: "Generic tips / hack framing" },
  { re: /\bbuy now\b|\blimited time\b|\bact fast\b/i, reason: "Pressure tactics" },
  { re: /\bcheapest\b|\bbest deal\b|\bmust-?have sku\b/i, reason: "Commodity framing" },
  { re: /\bonly elite\b|\bnot for everyone who can'?t afford\b/i, reason: "Buyer elitism" },
  { re: /\btechnology is ruining\b|\bburn your phone\b/i, reason: "Anti-technology absolutism" },
];

export type BrandFitResult = {
  ok: boolean;
  notes: string[];
};

export function assessBrandFit(text: string): BrandFitResult {
  const notes: string[] = [];
  for (const p of REJECT_PATTERNS) {
    if (p.re.test(text)) notes.push(p.reason);
  }
  if (notes.length) {
    return { ok: false, notes };
  }
  return {
    ok: true,
    notes: [
      "Quiet-luxury tone check passed (no clickbait, pressure, or commodity framing detected)",
    ],
  };
}

export function assertBrandFitOrNull<T extends { title: string; recommendedAction: string }>(
  item: T,
): T | null {
  const fit = assessBrandFit(`${item.title} ${item.recommendedAction}`);
  if (!fit.ok) return null;
  return item;
}
