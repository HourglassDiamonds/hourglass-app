/**
 * Founder-facing naming for routes, slugs, and internal recommendation labels.
 * Used by weekly (and shared) brief copy — never invents metrics.
 */

import { articles } from "@/app/diamond-guide/articles";
import {
  getEpisodeBySlug,
  getListableEpisodes,
} from "@/lib/conversations/episodes";
import { DIAMOND_SHAPE_STUDIO_NAME } from "@/lib/seo/schema/constants";

/** Public product names for known app routes. */
export const FOUNDER_ROUTE_NAMES: Record<string, string> = {
  "/diamond-studio": "Diamond Studio",
  "/diamond-shape-studio": DIAMOND_SHAPE_STUDIO_NAME,
  "/diamond-intelligence": "Diamond Intelligence",
  "/concierge": "Concierge",
  "/conversations": "Conversations",
  "/engagement-rings": "Engagement Rings",
  "/the-house": "The House",
  "/our-approach": "Our Approach",
};

const INTERNAL_PRIORITY_CATEGORY_RE =
  /^(repurposing gap|local intent gap|video to concierge handoff|trust building content|tool handoff gap|carousel opportunity|short form clip|sequence gap|measurement gap|source unavailable)\b/i;

/** Match leading-slash application paths (not URLs with scheme). */
export const RAW_APP_ROUTE_RE =
  /(?:^|[\s(])(\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)/gi;

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((w) => {
      if (/^(nc|sc|vs|gia|igi|gcal|ags|hrd)$/i.test(w)) return w.toUpperCase();
      if (/^(a|an|the|of|for|to|in|on|and|or|vs)$/i.test(w)) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function articleTitleBySlug(slug: string): string | null {
  const hit = articles.find((a) => a.slug === slug);
  return hit?.title ?? null;
}

function conversationTitleBySlug(slug: string): string | null {
  const episode = getEpisodeBySlug(slug);
  if (episode?.title) return episode.title;
  // Also accept common internal aliases
  const normalized = slug.replace(/_/g, "-");
  const again = getEpisodeBySlug(normalized);
  return again?.title ?? null;
}

/** Resolve a public name for an app path or return null to omit. */
export function formatFounderFacingRoute(path: string): string | null {
  const cleaned = path.trim().split(/[?#]/)[0] ?? "";
  if (!cleaned.startsWith("/")) return null;
  const normalized = cleaned.replace(/\/+$/, "") || "/";
  if (FOUNDER_ROUTE_NAMES[normalized]) return FOUNDER_ROUTE_NAMES[normalized];

  const guide = /^\/diamond-guide\/([a-z0-9-]+)$/i.exec(normalized);
  if (guide) {
    return (
      articleTitleBySlug(guide[1]!) ??
      `the Diamond Guide article “${titleCaseSlug(guide[1]!)}”`
    );
  }

  const convo = /^\/conversations\/([a-z0-9-]+)$/i.exec(normalized);
  if (convo) {
    return (
      conversationTitleBySlug(convo[1]!) ??
      `the Conversations episode “${titleCaseSlug(convo[1]!)}”`
    );
  }

  // Unknown single-segment or multi-segment — readable title case, never raw path
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return titleCaseSlug(parts[0]!);
  }
  return titleCaseSlug(parts[parts.length - 1]!);
}

/**
 * Replace raw `/routes` in founder copy with public names.
 * Unknown routes become title-case labels (never left as `/path`).
 */
export function replaceFounderFacingRoutes(text: string): string {
  return text.replace(RAW_APP_ROUTE_RE, (full, route: string) => {
    const prefix = full.slice(0, full.indexOf(route));
    const name = formatFounderFacingRoute(route);
    if (!name) return prefix.trimEnd() ? `${prefix.trimEnd()} ` : "";
    return `${prefix}${name}`;
  });
}

/** Public conversation / content key → display name. */
export function formatFounderFacingContentKey(key: string): string {
  const k = key.trim().replace(/^["“]|["”]$/g, "");
  // Already a founder-facing sentence — leave intact
  if (
    /^(turn|add|strengthen|use|design|finish|review|confirm|publish|plan|prioritize)\b/i.test(
      k,
    )
  ) {
    return k;
  }
  const slug = k
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");

  if (
    /^(why-we-re-here|why-were-here|why we.?re here|why diamond buying)/i.test(k) ||
    slug === "why-we-re-here" ||
    slug === "why-were-here"
  ) {
    return (
      conversationTitleBySlug("why-we-re-here") ??
      "Why Diamond Buying Should Still Feel Human"
    );
  }

  const episode = conversationTitleBySlug(slug);
  if (episode) return episode;

  const article = articleTitleBySlug(slug);
  if (article) return article;

  if (/^charlotte guides?( hub)?$/i.test(k)) return "Charlotte Guides hub";
  if (/^diamond studio$/i.test(k)) return "Diamond Studio";
  if (/^(see it on your hand|shape studio)$/i.test(k)) {
    return DIAMOND_SHAPE_STUDIO_NAME;
  }
  if (/^concierge$/i.test(k)) return "Concierge";

  // kebab / snake leftovers
  if (/[-_]/.test(k) && !/\s/.test(k)) return titleCaseSlug(k);
  return k;
}

function chooseStudioDestination(context: string): {
  primary: string;
  secondary: string | null;
  reason: string;
} {
  const c = context.toLowerCase();
  const shapePrimary =
    /fancy|shape|cut.?grade|oval|cushion|emerald|pear|marquise|radiant|asscher|visualization|on.?hand|on your hand/.test(
      c,
    );
  const sizePrimary =
    /carat|size|finger|coverage|mm\b|diameter/.test(c) && !shapePrimary;

  if (shapePrimary) {
    return {
      primary: DIAMOND_SHAPE_STUDIO_NAME,
      secondary: null,
      reason:
        "Readers on that page are already comparing shape characteristics, making the visualization tool the most natural next step toward a qualified consultation",
    };
  }
  if (sizePrimary) {
    return {
      primary: "Diamond Studio",
      secondary: null,
      reason:
        "Readers weighing size and coverage are closest to a size-visualization step before a consultation",
    };
  }
  // Default: prefer See It On Your Hand for educational handoffs; mention Diamond Studio only when both were candidates without clear shape/size cue
  if (/diamond-studio|size studio/i.test(c) && /shape-studio|see it on your hand/i.test(c)) {
    return {
      primary: DIAMOND_SHAPE_STUDIO_NAME,
      secondary: null,
      reason:
        "A single clear next step beats an ambiguous choice; the visualization tool is the stronger path from education to consultation",
    };
  }
  return {
    primary: DIAMOND_SHAPE_STUDIO_NAME,
    secondary: null,
    reason:
      "A clear product handoff keeps interested readers moving toward a qualified consultation",
  };
}

/**
 * Rewrite indirect/tool-handoff recommendations into a decisive founder action.
 * Removes Propose / and/or / raw routes.
 */
export function makeDecisiveFounderRecommendation(text: string): string {
  let t = replaceFounderFacingRoutes(text).trim();
  t = t.replace(/\band\/or\b/gi, " or ");

  const linkMatch =
    /(?:propose|add|include|insert)?\s*(?:an?\s+)?(?:editorial|contextual)?\s*link from (.+?) to (.+?)(?:\.|$)/i.exec(
      t,
    );
  if (linkMatch) {
    let fromRaw = linkMatch[1]!.trim();
    fromRaw = fromRaw.replace(/^the\s+/i, "").replace(/["“”]/g, "");
    // If still a slug-like leftover, resolve via content key
    const fromResolved = formatFounderFacingContentKey(
      fromRaw.replace(/^Diamond Guide article\s+/i, ""),
    );
    const fromLabel =
      /article|guide|fancy|cut grades|“|”|"/i.test(fromResolved) ||
      fromResolved.length > 24
        ? fromResolved.startsWith("“") || /^the\s/i.test(fromResolved)
          ? fromResolved
          : `“${fromResolved}”`
        : `“${fromResolved}”`;

    const dest = chooseStudioDestination(`${fromRaw} ${linkMatch[2]} ${t}`);
    const lead = `Add a contextual link from ${fromLabel} to ${dest.primary}.`;
    const why = dest.reason.endsWith(".") ? dest.reason : `${dest.reason}.`;
    return `${lead} ${why}`;
  }

  t = t
    .replace(/^Propose\b/i, "Add")
    .replace(/^Consider\b/i, "Prioritize")
    .replace(/^Investigate\b/i, "Review");
  return t;
}

/**
 * Convert an internal priority title/id into a concise founder-facing action.
 */
export function toFounderFacingPriorityAction(
  title: string,
  proposedAction?: string,
): string {
  const raw = title.trim().replace(/^\[[^\]]+\]\s*/, "");
  // Already a founder-facing action sentence — do not re-wrap.
  if (
    /^(turn|add|strengthen|use|design|finish|review|confirm|publish|plan|prioritize)\b/i.test(
      raw,
    )
  ) {
    return replaceFounderFacingRoutes(raw);
  }

  const actionHint = proposedAction
    ? replaceFounderFacingRoutes(proposedAction)
    : "";

  // Prefer decisive rewrite when the action itself is a handoff recommendation
  if (
    actionHint &&
    /link from|handoff|concierge|short-form|short form|charlotte guides|carousel/i.test(
      actionHint,
    )
  ) {
    if (/link from/i.test(actionHint)) {
      return makeDecisiveFounderRecommendation(actionHint)
        .split(/(?<=\.)\s+/)[0]!
        .trim();
    }
  }

  const idLike =
    /^[a-z0-9-]+:[a-z0-9:-]+$/i.test(raw) ||
    /:(repository|journey|gbp|bi):/i.test(raw);

  let category = "";
  let subject = raw;
  if (idLike) {
    const parts = raw.split(":").filter(Boolean);
    const start =
      parts.length >= 3 &&
      /^(content|search-strategy|business-intelligence|opportunity|chief-of-staff)$/i.test(
        parts[0]!,
      )
        ? 2
        : 0;
    const rest = parts.slice(start);
    category = (rest[0] ?? "").replace(/-/g, " ");
    subject = rest.slice(1).join(" ") || rest.join(" ");
  } else if (INTERNAL_PRIORITY_CATEGORY_RE.test(raw)) {
    const m = INTERNAL_PRIORITY_CATEGORY_RE.exec(raw);
    category = m?.[1] ?? "";
    subject = raw.slice(m?.[0].length ?? 0).trim();
  }

  const subjectKey = subject
    .replace(/\bshort form clip\b/gi, "")
    .replace(/\bcarousel\b/gi, "")
    .replace(/\bstudio to conversation\b/gi, "Diamond Studio")
    .trim();
  const contentName = formatFounderFacingContentKey(
    subjectKey || subject || "this asset",
  );

  const cat = category.toLowerCase();
  if (/repurposing/.test(cat) || /short form/.test(cat)) {
    return `Turn “${contentName}” into one additional short-form clip.`;
  }
  if (/local intent/.test(cat) || /charlotte guides/i.test(raw + subject)) {
    return "Strengthen the Charlotte Guides hub so local-intent content has a clearer destination.";
  }
  if (/video to concierge|concierge handoff/.test(cat)) {
    return `Add a natural Concierge handoff beneath the “${contentName}” conversation.`;
  }
  if (/trust building/.test(cat) || /studio to conversation/i.test(raw)) {
    return "Use Diamond Studio content to reinforce the path from education to conversation.";
  }
  if (/tool handoff/.test(cat)) {
    return makeDecisiveFounderRecommendation(
      actionHint ||
        `Add a contextual link from ${contentName} to ${DIAMOND_SHAPE_STUDIO_NAME}.`,
    )
      .split(/(?<=\.)\s+/)[0]!
      .trim();
  }
  if (/carousel/.test(cat)) {
    return `Design a quiet carousel that walks through the key ideas from “${contentName}.”`;
  }
  if (/sequence/.test(cat)) {
    return `Finish the remaining assets for “${contentName}” before treating it as publish-ready.`;
  }

  // Humanized title that still starts with a noun phrase — give it a verb
  const cleaned = replaceFounderFacingRoutes(raw.replace(/-/g, " "));
  if (
    /^(turn|add|strengthen|use|design|finish|review|confirm|publish|plan|prioritize)\b/i.test(
      cleaned,
    )
  ) {
    return cleaned;
  }
  const named = formatFounderFacingContentKey(cleaned);
  if (
    /^(turn|add|strengthen|use|design|finish|review|confirm|publish|plan|prioritize)\b/i.test(
      named,
    )
  ) {
    return named;
  }
  if (actionHint && actionHint.length > 24 && actionHint.length < 180) {
    const first = makeDecisiveFounderRecommendation(actionHint)
      .split(/(?<=\.)\s+/)[0]!
      .trim();
    if (first && !INTERNAL_PRIORITY_CATEGORY_RE.test(first)) return first;
  }
  return `Prioritize “${named}” as a concrete next editorial step.`;
}

/**
 * Strip internal implementation phrasing from founder-facing weekly narrative.
 * Does not invent metrics — only rewrites known engineering phrasing.
 */
export function sanitizeFounderFacingNarrative(text: string): string {
  let out = replaceFounderFacingRoutes(text);
  out = out
    .replace(
      /\b[Rr]epository review\b/g,
      "A review of the website and content",
    )
    .replace(
      /\brepository review surfaced\b/gi,
      "a review of the website and content surfaced",
    )
    .replace(
      /\bfrom the repository\b/gi,
      "from the website and content",
    )
    .replace(/\brepository-backed\b/gi, "site-backed")
    .replace(/\brepository analysis\b/gi, "website and content review")
    .replace(/\brepository findings\b/gi, "website and content findings")
    .replace(/\brepository material\b/gi, "site content")
    .replace(/\bin the repository\b/gi, "on the site")
    .replace(/\brepository\b/gi, "website and content");
  // Avoid awkward doubles from partial replacements
  out = out
    .replace(/\bwebsite and content and content\b/gi, "website and content")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

/** Honest founder-facing "what changed" when original narrative is unavailable. */
export function synthesizeWeeklyWhatChanged(input: {
  recommendationTitles: string[];
  missingOrUnreliableData: string[];
}): string {
  const hasContentOrSearch = input.recommendationTitles.some((t) =>
    /content|search|guide|studio|concierge|clip|handoff|charlotte/i.test(t),
  );
  const weakAnalytics = input.missingOrUnreliableData.some((g) =>
    /ga4|gsc|analytics|search console|website/i.test(g),
  );
  if (hasContentOrSearch && weakAnalytics) {
    return "A review of the website and content surfaced concrete opportunities to improve search visibility and guide more visitors toward a conversation, while incomplete performance data limited the strength of this week’s conclusions.";
  }
  if (hasContentOrSearch) {
    return "Website and content review highlighted concrete opportunities to improve search visibility and guide more visitors toward a conversation.";
  }
  if (weakAnalytics) {
    return "Performance coverage stayed thin, so the week’s signal is directional rather than conclusive.";
  }
  return "No material verified performance change stood out beyond the operating priorities below.";
}

/** Situation-level weekly executive summary — must not copy the ROI action. */
export function synthesizeWeeklyExecutiveSummary(input: {
  whyItMatters: string;
  whatChanged: string;
  highestRoiAction: string;
  weakEvidence?: boolean;
}): string {
  const why = input.whyItMatters.trim();
  const changed = input.whatChanged.trim();
  const action = input.highestRoiAction.trim();

  const nearDuplicate = (a: string, b: string) => {
    const na = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const ta = new Set(na.split(" ").filter((w) => w.length > 3));
    const tb = [...nb.split(" ").filter((w) => w.length > 3)];
    if (ta.size === 0 || tb.length === 0) return false;
    let inter = 0;
    for (const w of tb) if (ta.has(w)) inter += 1;
    return inter / Math.max(ta.size, tb.length) >= 0.72;
  };

  if (
    why &&
    why.length <= 280 &&
    !/^no high-confidence/i.test(why) &&
    !/measurement gaps dominate/i.test(why) &&
    !nearDuplicate(why, action) &&
    !/reconstructed|persisted|delivery ledger|fixture|week:\d{4}-w/i.test(why)
  ) {
    return replaceFounderFacingRoutes(why);
  }

  if (
    changed &&
    changed.length <= 260 &&
    !/^insufficient metric coverage/i.test(changed) &&
    !nearDuplicate(changed, action) &&
    !/reconstructed|persisted|delivery ledger|fixture|week:\d{4}-w/i.test(
      changed,
    )
  ) {
    return replaceFounderFacingRoutes(changed);
  }

  if (input.weakEvidence) {
    return "This week produced useful content and search opportunities, but the evidence does not yet support a major strategic change. Keep the focus on clear, low-effort handoffs.";
  }

  return "Operating signal this week favors tightening education-to-product handoffs over launching a new growth initiative.";
}

/** Expose episode list for tests / debugging without leaking into email. */
export function knownConversationTitles(): string[] {
  return getListableEpisodes({ includeDrafts: true }).map((e) => e.title);
}
