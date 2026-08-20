import {
  DIAMOND_GUIDE_CATEGORIES,
  getCategoryConfig,
  type DiamondGuideCategorySegment,
} from "@/lib/seo/diamond-guide-metadata";

export type GuideNavGroupId = DiamondGuideCategorySegment;

export type GuideNavGroup = {
  id: GuideNavGroupId;
  title: string;
  navTitle: string;
  description: string;
  href: string;
  articleCategory: string;
};

export type GuideArticleSummary = {
  slug: string;
  href: string;
  title: string;
  category: string;
  excerpt: string;
};

export type GuideSearchRecord = GuideArticleSummary & {
  keywords: string[];
  haystack: string;
};

export type RelatedReadingLink = {
  title: string;
  href: string;
};

export type RelatedReading = {
  articles: RelatedReadingLink[];
  studio: RelatedReadingLink | null;
};

export type BuyingPathStep = {
  title: string;
  href: string;
  note: string;
  kind: "article" | "tool";
};

export type GuideBreadcrumbItem = {
  name: string;
  href?: string;
};

export type CategoryPreview = {
  group: GuideNavGroup;
  articles: GuideArticleSummary[];
};

/** Hub copy used on /diamond-guide — derived from the category registry. */
export const GUIDE_NAV_GROUPS: GuideNavGroup[] = DIAMOND_GUIDE_CATEGORIES.map(
  (category) => ({
    id: category.segment,
    title: category.navTitle,
    navTitle: category.navTitle,
    description: category.consumerDescription,
    href: `/diamond-guide/${category.segment}`,
    articleCategory: category.articleCategory,
  }),
);

export const BUYING_PATH: BuyingPathStep[] = [
  {
    title: "Natural vs Lab Diamonds",
    href: "/diamond-guide/natural-vs-lab-diamonds",
    note: "Decide origin before you compare stones on paper.",
    kind: "article",
  },
  {
    title: "How to Read a Diamond Certificate",
    href: "/diamond-guide/how-to-read-a-diamond-certificate",
    note: "Learn the document every serious listing will show you.",
    kind: "article",
  },
  {
    title: "What is Diamond Cut",
    href: "/diamond-guide/what-is-diamond-cut",
    note: "Cut is what gives a diamond its life and sparkle.",
    kind: "article",
  },
  {
    title: "What is Diamond Color",
    href: "/diamond-guide/what-is-diamond-color",
    note: "When the letter on the report actually shows on the hand.",
    kind: "article",
  },
  {
    title: "What is Diamond Clarity",
    href: "/diamond-guide/what-is-diamond-clarity",
    note: "What you will see, and what usually stays under the loupe.",
    kind: "article",
  },
  {
    title: "What is a Carat?",
    href: "/diamond-guide/what-is-a-carat",
    note: "Weight is not the same as how large the diamond looks.",
    kind: "article",
  },
  {
    title: "Oval vs Round Diamond",
    href: "/diamond-guide/oval-vs-round-diamond",
    note: "The shape comparison most first-time buyers make first.",
    kind: "article",
  },
  {
    title: "What Is Diamond Fluorescence",
    href: "/diamond-guide/what-is-diamond-fluorescence",
    note: "A quiet factor that can help, or occasionally hurt, appearance.",
    kind: "article",
  },
  {
    title: "Diamond Price vs Quality",
    href: "/diamond-guide/diamond-price-vs-quality",
    note: "Where to spend, and where the extra money rarely shows.",
    kind: "article",
  },
  {
    title: "See size in Diamond Studio",
    href: "/diamond-studio",
    note: "Check apparent size and finger coverage before you choose.",
    kind: "tool",
  },
];

export const INTENTIONAL_RELATED: Record<string, string[]> = {
  "what-is-diamond-color": [
    "what-is-diamond-cut",
    "what-is-diamond-fluorescence",
    "what-is-diamond-clarity",
  ],
  "what-is-diamond-cut": [
    "what-is-diamond-color",
    "how-diamond-cut-affects-sparkle",
    "is-diamond-cut-the-most-important-c",
  ],
  "what-is-diamond-clarity": [
    "what-is-diamond-color",
    "vs1-vs-vs2-diamond-clarity",
    "what-is-diamond-cut",
  ],
  "what-is-a-carat": [
    "diamond-size-chart",
    "diamond-size-on-hand",
    "how-big-is-a-1-carat-diamond",
  ],
  "how-to-read-a-diamond-certificate": [
    "what-is-a-diamond-certificate",
    "are-all-diamond-certificates-the-same",
    "gia-diamond-certification-explained",
  ],
  "natural-vs-lab-diamonds": [
    "are-lab-diamonds-a-good-choice",
    "do-lab-grown-diamonds-have-certificates",
    "what-is-diamond-cut",
  ],
  "what-is-diamond-fluorescence": [
    "what-is-diamond-color",
    "when-fluorescence-improves-a-diamond",
    "does-fluorescence-affect-diamond-value",
  ],
  "oval-diamond-guide": [
    "oval-vs-round-diamond",
    "round-diamond-guide",
    "what-diamond-shape-looks-the-largest",
  ],
  "diamond-price-vs-quality": [
    "what-is-diamond-cut",
    "natural-vs-lab-diamonds",
    "how-to-read-a-diamond-certificate",
  ],
};

export const SEARCH_ALIASES: Record<string, string[]> = {
  "natural-vs-lab-diamonds": [
    "lab grown",
    "lab-grown",
    "lab grown diamonds",
    "natural vs lab",
  ],
  "are-lab-diamonds-a-good-choice": ["lab grown", "lab-grown"],
  "vs1-vs-vs2-diamond-clarity": ["vs1 vs vs2", "vs1 vs2", "vs2 vs1"],
  "what-is-diamond-fluorescence": ["fluorescence", "fluoro"],
  "oval-diamond-guide": ["oval diamonds", "oval cut"],
  "what-is-a-carat": ["carat weight", "carat size"],
  "how-to-read-a-diamond-certificate": [
    "diamond certificates",
    "grading report",
    "diamond cert",
  ],
  "what-is-a-diamond-certificate": ["diamond certificates", "grading report"],
  "diamond-size-on-hand": ["finger", "on the hand", "finger coverage"],
  "what-diamond-shape-looks-the-largest": ["visual comparison", "looks bigger"],
  "charlotte-diamond-advisor-guide": ["charlotte", "charlotte diamond"],
  "buy-diamonds-in-charlotte": ["charlotte", "buy diamonds charlotte"],
  "charlotte-engagement-ring-guide": ["charlotte", "charlotte engagement ring"],
};

export const STUDIO_TOOL: RelatedReadingLink = {
  title: "See it in Diamond Studio",
  href: "/diamond-studio",
};

export const STUDIO_CATEGORY_HINTS = new Set(["Diamond Size", "Diamond Shapes"]);

export const STUDIO_SLUG_RE =
  /carat|size|shape|finger|on-hand|elongated|spread|looks-the-largest|look-bigger/i;

export const PREVIEW_SLUGS: Partial<Record<GuideNavGroupId, string[]>> = {
  "diamond-size": [
    "what-is-a-carat",
    "how-big-is-a-1-carat-diamond",
    "diamond-size-chart",
    "diamond-size-on-hand",
  ],
  "diamond-shapes": [
    "round-diamond-guide",
    "oval-diamond-guide",
    "emerald-diamond-guide",
    "cushion-diamond-guide",
  ],
  "diamond-cut": [
    "what-is-diamond-cut",
    "excellent-vs-very-good-diamond-cut",
    "ideal-diamond-cut-proportions",
    "what-makes-a-diamond-cut-good-or-bad",
  ],
  "light-performance": [
    "what-is-diamond-brilliance",
    "diamond-fire-explained",
    "what-is-diamond-scintillation",
    "diamond-light-return-explained",
  ],
  "diamond-color": [
    "what-is-diamond-color",
    "diamond-color-chart-explained",
    "best-diamond-color-for-engagement-rings",
    "does-diamond-color-matter",
  ],
  "diamond-clarity": [
    "what-is-diamond-clarity",
    "vs1-vs-vs2-diamond-clarity",
    "eye-clean-diamonds-explained",
    "diamond-clarity-chart-explained",
  ],
  certification: [
    "how-to-read-a-diamond-certificate",
    "what-is-a-diamond-certificate",
    "gia-diamond-certification-explained",
    "are-all-diamond-certificates-the-same",
  ],
  "buying-strategy": [
    "natural-vs-lab-diamonds",
    "diamond-price-vs-quality",
    "diamond-buying-tips-from-jewelers",
    "why-work-with-a-graduate-gemologist",
  ],
  "charlotte-guides": [
    "charlotte-diamond-advisor-guide",
    "buy-diamonds-in-charlotte",
    "charlotte-engagement-ring-guide",
    "best-diamond-shapes-charlotte",
  ],
  "proposal-planning": [
    "best-places-to-propose-in-charlotte",
    "how-to-plan-a-proposal-in-charlotte",
    "best-proposal-photographers-in-charlotte",
    "first-30-days-after-you-get-engaged",
  ],
};

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;

export function stripInlineMarkdown(text: string): string {
  return text.replace(MARKDOWN_LINK_RE, "$1").replace(/\s+/g, " ").trim();
}

export function guideHubCategories(): GuideNavGroup[] {
  return GUIDE_NAV_GROUPS;
}

export function guideIndexGroups(): GuideNavGroup[] {
  return GUIDE_NAV_GROUPS;
}

export function categoryVisualBreadcrumbs(
  segment: DiamondGuideCategorySegment,
  variant: "hub" | "index",
): GuideBreadcrumbItem[] {
  const config = getCategoryConfig(segment);
  const hubHref = `/diamond-guide/${segment}`;
  const crumbs: GuideBreadcrumbItem[] = [
    { name: "Diamond Guide", href: "/diamond-guide" },
  ];

  if (variant === "hub") {
    crumbs.push({ name: config.navTitle });
    return crumbs;
  }

  crumbs.push({ name: config.navTitle, href: hubHref });
  crumbs.push({ name: config.indexTitle });
  return crumbs;
}
