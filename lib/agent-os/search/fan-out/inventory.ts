/**
 * Normalized Hourglass-owned content inventory for fan-out coverage.
 * Static imports only — no production scraping, no filesystem walks.
 */

import { articles, type Article } from "@/app/diamond-guide/articles";
import { APPROACH_CHAPTERS } from "@/app/our-approach/content";
import {
  CONVERSATION_EPISODES,
  type ConversationEpisode,
} from "@/lib/conversations/episodes";
import { CHARLOTTE_ADVISOR_FAQS } from "@/lib/seo/charlotte-advisor-educational";
import { CLARITY_FAQS } from "@/lib/seo/clarity-educational";
import { COLOR_FAQS } from "@/lib/seo/color-educational";
import { CUT_FAQS } from "@/lib/seo/cut-educational";
import { DIAMOND_INTELLIGENCE_FAQS } from "@/lib/seo/diamond-intelligence-educational";
import { ENGAGEMENT_RINGS_FAQS } from "@/lib/seo/engagement-rings-educational";
import { FLUORESCENCE_FAQS } from "@/lib/seo/fluorescence-educational";
import { LAB_NATURAL_FAQS } from "@/lib/seo/lab-natural-educational";
import { CERTIFICATE_READER_FAQS } from "@/lib/seo/certificate-reader-educational";
import { FAQ_SCHEMA_ARTICLE_SLUGS } from "../guide-authority";
import { canonicalSourceIdFromUrl } from "./canonical";
import { normalizeText, slugifyFanOutId } from "./normalize";
import type { FanOutContentRecord, FanOutContentType, FanOutGeography } from "./types";

type FaqPair = { question: string; answer: string };

export type BuildFanOutInventoryOptions = {
  articleList?: Article[];
  episodes?: ConversationEpisode[];
  includeApproach?: boolean;
  includeFaqs?: boolean;
  includeCorePages?: boolean;
  includeTestimonials?: boolean;
};

const CATEGORY_TOPICS: Record<string, string[]> = {
  "Diamond Cut": ["cut", "cut-and-sparkle"],
  "Light Performance": ["cut-and-sparkle", "light-performance", "sparkle"],
  "Diamond Color": ["color", "diamond-quality", "fluorescence"],
  "Diamond Clarity": ["clarity", "diamond-quality"],
  "Diamond Shapes": ["shapes", "shapes-and-appearance"],
  "Diamond Size": ["size", "shapes-and-appearance"],
  Certification: ["certification", "diamond-quality"],
  "Buying Guides": ["buying-guides", "pricing", "natural-vs-lab"],
  "Proposal Planning": ["proposal", "proposal-and-surprise", "local"],
  "Charlotte Guides": ["local", "local-charlotte-intent", "charlotte"],
};

function geographyFromText(text: string): FanOutGeography {
  const n = normalizeText(text);
  if (n.includes("waxhaw")) return "waxhaw";
  if (
    n.includes("charlotte") ||
    n.includes("ballantyne") ||
    n.includes("weddington") ||
    n.includes("marvin") ||
    n.includes("fort mill")
  ) {
    return n.includes("metro") || n.includes("surrounding") || n.includes("waxhaw")
      ? "charlotte-metro"
      : "charlotte";
  }
  return "unspecified";
}

function articleExtract(article: Article): string {
  const parts: string[] = [article.title, article.category];
  for (const block of article.body.slice(0, 8)) {
    if (block.type === "paragraph" || block.type === "heading") {
      parts.push(block.text.slice(0, 280));
    }
    if (block.type === "studio-callout") {
      parts.push(block.text.slice(0, 200));
    }
  }
  for (const rel of article.related ?? []) {
    parts.push(rel.title);
  }
  return parts.join(" ").slice(0, 1200);
}

function collectArticleHrefs(article: Article): string[] {
  const hrefs: string[] = [];
  for (const r of article.related ?? []) {
    if (r.href) hrefs.push(r.href);
  }
  for (const block of article.body) {
    if (
      block.type === "paragraph" ||
      block.type === "heading" ||
      block.type === "studio-callout"
    ) {
      const matches = block.text.matchAll(/\((\/[a-z0-9\-/_]+)\)/gi);
      for (const m of matches) {
        if (m[1]) hrefs.push(m[1]);
      }
    }
  }
  return hrefs;
}

function record(input: {
  url: string;
  title: string;
  contentType: FanOutContentType;
  summary: string;
  topics: string[];
  entities?: string[];
  geography?: FanOutGeography;
  publicationStatus?: FanOutContentRecord["publicationStatus"];
  publishedOrUpdatedAt?: string | null;
  hasStructuredData?: boolean;
  sourceSystemId: string;
  relatedHrefs?: string[];
  canonicalSourceId?: string;
}): FanOutContentRecord {
  const searchableText = [
    input.title,
    input.summary,
    ...input.topics,
    ...(input.entities ?? []),
  ].join(" ");
  return {
    id: `fan-out-content:${slugifyFanOutId(input.url || input.title)}`,
    url: input.url,
    title: input.title,
    contentType: input.contentType,
    summary: input.summary.slice(0, 500),
    topics: input.topics,
    entities: input.entities ?? [],
    geography: input.geography ?? geographyFromText(`${input.title} ${input.summary}`),
    publicationStatus: input.publicationStatus ?? "published",
    publishedOrUpdatedAt: input.publishedOrUpdatedAt ?? null,
    hasStructuredData: input.hasStructuredData ?? false,
    sourceSystemId: input.sourceSystemId,
    canonicalSourceId:
      input.canonicalSourceId ?? canonicalSourceIdFromUrl(input.url),
    searchableText,
    relatedHrefs: input.relatedHrefs ?? [],
  };
}

function corePages(): FanOutContentRecord[] {
  const pages: Array<{
    url: string;
    title: string;
    summary: string;
    topics: string[];
    entities?: string[];
    contentType?: FanOutContentType;
    hasStructuredData?: boolean;
  }> = [
    {
      url: "/",
      title: "Hourglass Diamonds",
      summary:
        "Private Charlotte jeweler for engagement rings, custom design, and Graduate Gemologist guidance.",
      topics: ["brand", "local", "private-client"],
      entities: ["hourglass", "charlotte"],
    },
    {
      url: "/engagement-rings",
      title: "Engagement Rings",
      summary:
        "Private engagement ring design, diamond sourcing, custom process, Charlotte and Waxhaw service, Concierge conversation.",
      topics: ["engagement-ring", "custom-design", "private-client", "local"],
      entities: ["engagement-ring", "concierge"],
      hasStructuredData: true,
    },
    {
      url: "/custom-design",
      title: "Custom Design",
      summary:
        "Custom engagement ring design process, timelines, private appointment, diamond and setting together.",
      topics: ["custom-design", "private-client"],
      entities: ["custom-design"],
      contentType: "local-landing",
    },
    {
      url: "/concierge",
      title: "Concierge",
      summary:
        "What happens after you contact Hourglass: share direction, timeline, and budget for a calm next step.",
      topics: ["concierge", "buying-process", "ready-to-contact"],
      entities: ["concierge"],
    },
    {
      url: "/our-approach",
      title: "Our Approach",
      summary:
        "Selection philosophy, why curated diamonds, Graduate Gemologist standards, rejecting weak stones.",
      topics: ["trust", "approach", "quality", "selection"],
      entities: ["selection-philosophy", "graduate-gemologist"],
    },
    {
      url: "/the-house",
      title: "The House",
      summary: "Hourglass house story, private client positioning, brand credibility.",
      topics: ["brand", "private-client", "trust"],
      entities: ["hourglass"],
    },
    {
      url: "/whispered-praise",
      title: "Whispered Praise",
      summary:
        "Client testimonials and reviews about trust, guidance, and engagement ring experience.",
      topics: ["trust", "testimonials"],
      entities: ["testimonial"],
      contentType: "testimonial",
    },
    {
      url: "/diamond-intelligence",
      title: "Analyze Sparkle / Diamond Intelligence",
      summary:
        "Certificate interpretation tool for GIA, IGI, GCAL reports; light performance context beyond summary grades.",
      topics: ["certification", "quality", "cut", "tools"],
      entities: ["diamond-intelligence"],
      contentType: "tool-page",
      hasStructuredData: true,
    },
    {
      url: "/diamond-studio",
      title: "Diamond Studio",
      summary: "Visual diamond size and coverage tool for on-hand comparison.",
      topics: ["size", "shapes", "tools"],
      entities: ["diamond-studio"],
      contentType: "tool-page",
      hasStructuredData: true,
    },
    {
      url: "/diamond-shape-studio",
      title: "See It On Your Hand",
      summary: "Shape visualization on hand for comparing diamond shapes and face-up size.",
      topics: ["shapes", "size", "tools"],
      entities: ["shape-studio"],
      contentType: "tool-page",
      hasStructuredData: true,
    },
    {
      url: "/diamond-guide",
      title: "Diamond Guide hub",
      summary: "Educational Diamond Guide library covering cut, color, clarity, shapes, buying, Charlotte.",
      topics: ["education", "buying-guides"],
      entities: ["diamond-guide"],
    },
    {
      url: "/conversations",
      title: "Conversations hub",
      summary: "Founder conversation series on Hourglass philosophy and diamond buying clarity.",
      topics: ["conversations", "trust", "founder"],
      entities: ["conversations"],
    },
  ];

  return pages.map((p) =>
    record({
      url: p.url,
      title: p.title,
      contentType: p.contentType ?? (p.url.includes("charlotte") ? "local-landing" : "core-page"),
      summary: p.summary,
      topics: p.topics,
      entities: p.entities,
      hasStructuredData: p.hasStructuredData ?? false,
      sourceSystemId: `route:${p.url}`,
      geography: geographyFromText(`${p.title} ${p.summary}`),
    }),
  );
}

function articleRecords(articleList: Article[]): FanOutContentRecord[] {
  return articleList.map((article) => {
    const url = `/diamond-guide/${article.slug}`;
    const topics = [
      ...(CATEGORY_TOPICS[article.category] ?? [normalizeText(article.category)]),
      ...article.slug.split("-").filter((t) => t.length > 3).slice(0, 6),
    ];
    return record({
      url,
      title: article.title,
      contentType: "diamond-guide-article",
      summary: articleExtract(article),
      topics,
      entities: [article.category, article.slug],
      geography: geographyFromText(`${article.title} ${article.category} ${article.slug}`),
      publicationStatus: "published",
      hasStructuredData: FAQ_SCHEMA_ARTICLE_SLUGS.has(article.slug),
      sourceSystemId: `app/diamond-guide/articles.ts#${article.slug}`,
      relatedHrefs: collectArticleHrefs(article),
    });
  });
}

function faqRecords(): FanOutContentRecord[] {
  const groups: Array<{
    source: string;
    route: string;
    faqs: FaqPair[];
    topics: string[];
    entities?: string[];
  }> = [
    {
      source: "lib/seo/cut-educational.ts",
      route: "/diamond-guide/what-is-diamond-cut",
      faqs: CUT_FAQS,
      topics: ["cut", "cut-and-sparkle"],
      entities: ["cut"],
    },
    {
      source: "lib/seo/color-educational.ts",
      route: "/diamond-guide/what-is-diamond-color",
      faqs: COLOR_FAQS,
      topics: ["color", "diamond-quality"],
    },
    {
      source: "lib/seo/clarity-educational.ts",
      route: "/diamond-guide/what-is-diamond-clarity",
      faqs: CLARITY_FAQS,
      topics: ["clarity", "diamond-quality"],
    },
    {
      source: "lib/seo/fluorescence-educational.ts",
      route: "/diamond-guide/what-is-diamond-fluorescence",
      faqs: FLUORESCENCE_FAQS,
      topics: ["fluorescence", "color"],
      entities: ["fluorescence"],
    },
    {
      source: "lib/seo/lab-natural-educational.ts",
      route: "/diamond-guide/natural-vs-lab-diamonds",
      faqs: LAB_NATURAL_FAQS,
      topics: ["natural-vs-lab", "pricing"],
      entities: ["lab-grown", "natural-diamond"],
    },
    {
      source: "lib/seo/certificate-reader-educational.ts",
      route: "/diamond-guide/how-to-read-a-diamond-certificate",
      faqs: CERTIFICATE_READER_FAQS,
      topics: ["certification", "quality"],
    },
    {
      source: "lib/seo/charlotte-advisor-educational.ts",
      route: "/diamond-guide/charlotte-diamond-advisor-guide",
      faqs: CHARLOTTE_ADVISOR_FAQS,
      topics: ["local", "trust", "jeweler-comparison"],
      entities: ["charlotte", "diamond-advisor"],
    },
    {
      source: "lib/seo/engagement-rings-educational.ts",
      route: "/engagement-rings",
      faqs: ENGAGEMENT_RINGS_FAQS,
      topics: ["engagement-ring", "custom-design", "concierge", "local"],
      entities: ["engagement-ring", "concierge"],
    },
    {
      source: "lib/seo/diamond-intelligence-educational.ts",
      route: "/diamond-intelligence",
      faqs: DIAMOND_INTELLIGENCE_FAQS,
      topics: ["certification", "tools", "quality"],
      entities: ["diamond-intelligence"],
    },
  ];

  const out: FanOutContentRecord[] = [];
  for (const group of groups) {
    for (const faq of group.faqs) {
      out.push(
        record({
          url: `${group.route}#faq-${slugifyFanOutId(faq.question)}`,
          title: faq.question,
          contentType: "faq",
          summary: faq.answer.slice(0, 500),
          topics: group.topics,
          entities: group.entities,
          hasStructuredData: true,
          sourceSystemId: `${group.source}#${slugifyFanOutId(faq.question)}`,
          geography: geographyFromText(`${faq.question} ${faq.answer}`),
        }),
      );
    }
  }
  return out;
}

function approachRecords(): FanOutContentRecord[] {
  const out: FanOutContentRecord[] = [];
  for (const chapter of APPROACH_CHAPTERS) {
    for (const question of chapter.questions) {
      out.push(
        record({
          url: `/our-approach#${question.id}`,
          title: question.question,
          contentType: "approach-qa",
          summary: question.paragraphs.join(" ").slice(0, 500),
          topics: ["trust", "approach", "quality", "selection", chapter.id],
          entities: ["selection-philosophy", "graduate-gemologist"],
          sourceSystemId: `app/our-approach/content.ts#${question.id}`,
          hasStructuredData: false,
        }),
      );
    }
  }
  return out;
}

function conversationRecords(episodes: ConversationEpisode[]): FanOutContentRecord[] {
  return episodes.map((ep) => {
    const transcriptText = ep.transcript
      .flatMap((section) => section.paragraphs)
      .join(" ")
      .slice(0, 400);
    const summary = [ep.summary, ep.centralIdea, ...ep.keyIdeas.map((k) => k.title)]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
    const hasTranscript = ep.transcript.some((s) => s.paragraphs.length > 0);
    const base = record({
      url: `/conversations/${ep.slug}`,
      title: ep.title,
      contentType: "conversation",
      summary,
      topics: ["conversations", "founder", "trust", ep.topicLabel ?? "philosophy"].filter(
        Boolean,
      ) as string[],
      entities: ["conversations", "founder"],
      publicationStatus: ep.status === "published" ? "published" : "draft",
      publishedOrUpdatedAt: ep.publishedAt ?? null,
      hasStructuredData: ep.status === "published",
      sourceSystemId: `lib/conversations/episodes.ts#${ep.slug}`,
      relatedHrefs: [ep.relatedArticle?.href, ep.relatedTool?.href].filter(
        (href): href is string => Boolean(href),
      ),
    });
    if (!hasTranscript) return [base];
    return [
      base,
      record({
        url: `/conversations/${ep.slug}#transcript`,
        title: `${ep.title} transcript`,
        contentType: "transcript",
        summary: transcriptText || summary,
        topics: base.topics,
        entities: base.entities,
        publicationStatus: base.publicationStatus,
        publishedOrUpdatedAt: base.publishedOrUpdatedAt,
        hasStructuredData: false,
        sourceSystemId: `lib/conversations/episodes.ts#${ep.slug}:transcript`,
      }),
    ];
  }).flat();
}

/**
 * Build a normalized inventory of Hourglass-owned content from repository sources.
 */
export function buildFanOutContentInventory(
  options: BuildFanOutInventoryOptions = {},
): FanOutContentRecord[] {
  const articleList = options.articleList ?? articles;
  const episodes = options.episodes ?? CONVERSATION_EPISODES;
  const includeApproach = options.includeApproach ?? true;
  const includeFaqs = options.includeFaqs ?? true;
  const includeCorePages = options.includeCorePages ?? true;
  const includeTestimonials = options.includeTestimonials ?? true;

  const items: FanOutContentRecord[] = [];
  if (includeCorePages) {
    items.push(...corePages().filter((p) => includeTestimonials || p.contentType !== "testimonial"));
  }
  items.push(...articleRecords(articleList));
  if (includeFaqs) items.push(...faqRecords());
  if (includeApproach) items.push(...approachRecords());
  items.push(...conversationRecords(episodes));

  // Stable dedupe by URL
  const seen = new Set<string>();
  const out: FanOutContentRecord[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

export function summarizeInventory(items: FanOutContentRecord[]): Record<FanOutContentType, number> {
  const counts = {} as Record<FanOutContentType, number>;
  for (const item of items) {
    counts[item.contentType] = (counts[item.contentType] ?? 0) + 1;
  }
  return counts;
}
