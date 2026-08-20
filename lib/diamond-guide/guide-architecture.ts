import { articles, type Article } from "@/app/diamond-guide/articles";
import {
  DIAMOND_GUIDE_CATEGORIES,
  type DiamondGuideCategorySegment,
} from "@/lib/seo/diamond-guide-metadata";
import { articleCategorySegment } from "@/lib/seo/schema/category-map";
import {
  GUIDE_NAV_GROUPS,
  INTENTIONAL_RELATED,
  PREVIEW_SLUGS,
  SEARCH_ALIASES,
  STUDIO_CATEGORY_HINTS,
  STUDIO_SLUG_RE,
  STUDIO_TOOL,
  guideHubCategories,
  guideIndexGroups,
  stripInlineMarkdown,
  type GuideArticleSummary,
  type GuideBreadcrumbItem,
  type GuideNavGroup,
  type GuideSearchRecord,
  type RelatedReading,
  type RelatedReadingLink,
} from "./guide-nav";
import { normalizeSearch } from "./guide-search";

export {
  BUYING_PATH,
  categoryVisualBreadcrumbs,
  guideHubCategories,
  guideIndexGroups,
} from "./guide-nav";
export type {
  BuyingPathStep,
  CategoryPreview,
  GuideArticleSummary,
  GuideBreadcrumbItem,
  GuideNavGroup,
  GuideSearchRecord,
  RelatedReading,
} from "./guide-nav";
export { searchGuideArticles } from "./guide-search";

export function articleExcerpt(article: Article): string {
  const firstParagraph = article.body.find((block) => block.type === "paragraph");
  if (!firstParagraph || firstParagraph.type !== "paragraph") {
    return "Practical diamond guidance from Hourglass Diamonds.";
  }

  const plain = stripInlineMarkdown(firstParagraph.text);
  if (plain.length <= 160) return plain;

  const window = plain.slice(0, 160);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
  );
  if (sentenceEnd >= 80) {
    return plain.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = window.lastIndexOf(" ");
  if (wordEnd >= 80) {
    return `${plain.slice(0, wordEnd).trim()}…`;
  }

  return plain.slice(0, 160).trim();
}

export function articlesForGroup(group: GuideNavGroup): Article[] {
  return articles
    .filter((article) => article.category === group.articleCategory)
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function orderedArticlesForGroup(group: GuideNavGroup): Article[] {
  const bySlug = new Map(
    articlesForGroup(group).map((article) => [article.slug, article]),
  );
  const preferred = (PREVIEW_SLUGS[group.id] ?? [])
    .map((slug) => bySlug.get(slug))
    .filter((article): article is Article => Boolean(article));
  const rest = articlesForGroup(group).filter(
    (article) => !preferred.some((item) => item.slug === article.slug),
  );
  return [...preferred, ...rest];
}

export function navGroupForSegment(
  segment: DiamondGuideCategorySegment,
): GuideNavGroup | undefined {
  return GUIDE_NAV_GROUPS.find((group) => group.id === segment);
}

export function orderedArticlesForSegment(
  segment: DiamondGuideCategorySegment,
): Article[] {
  const group = navGroupForSegment(segment);
  if (!group) return [];
  return orderedArticlesForGroup(group);
}

export function toSummary(article: Article): GuideArticleSummary {
  return {
    slug: article.slug,
    href: `/diamond-guide/${article.slug}`,
    title: article.title,
    category: article.category,
    excerpt: articleExcerpt(article),
  };
}

export function groupedGuideLibrary(): {
  group: GuideNavGroup;
  articles: GuideArticleSummary[];
}[] {
  return guideIndexGroups().map((group) => ({
    group,
    articles: orderedArticlesForGroup(group).map(toSummary),
  }));
}

export function uncategorizedArticles(): Article[] {
  const known = new Set(GUIDE_NAV_GROUPS.map((group) => group.articleCategory));
  return articles.filter((article) => !known.has(article.category));
}

function headingTexts(article: Article): string[] {
  return article.body
    .filter((block) => block.type === "heading")
    .map((block) => block.text);
}

export function buildGuideSearchIndex(
  articleList: Article[] = articles,
): GuideSearchRecord[] {
  return articleList.map((article) => {
    const excerpt = articleExcerpt(article);
    const headings = headingTexts(article);
    const group = GUIDE_NAV_GROUPS.find(
      (item) => item.articleCategory === article.category,
    );
    const aliases = SEARCH_ALIASES[article.slug] ?? [];
    const keywords = [
      article.slug.replace(/-/g, " "),
      ...headings,
      ...aliases,
      group?.navTitle ?? "",
    ].filter(Boolean);
    const haystack = normalizeSearch(
      [
        article.title,
        article.category,
        group?.navTitle ?? "",
        group?.title ?? "",
        excerpt,
        article.slug.replace(/-/g, " "),
        headings.join(" "),
        aliases.join(" "),
      ].join(" "),
    );

    return {
      ...toSummary(article),
      excerpt,
      keywords,
      haystack,
    };
  });
}

function articleBySlug(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

function linkFromArticle(article: Article): RelatedReadingLink {
  return { title: article.title, href: `/diamond-guide/${article.slug}` };
}

function shouldSurfaceStudio(article: Article): boolean {
  if (STUDIO_CATEGORY_HINTS.has(article.category)) return true;
  return STUDIO_SLUG_RE.test(article.slug);
}

export function resolveRelatedReading(article: Article): RelatedReading {
  const seen = new Set<string>([`/diamond-guide/${article.slug}`]);
  const next: RelatedReadingLink[] = [];

  const intentional = INTENTIONAL_RELATED[article.slug] ?? [];
  for (const slug of intentional) {
    const match = articleBySlug(slug);
    if (!match) continue;
    const href = `/diamond-guide/${match.slug}`;
    if (seen.has(href)) continue;
    seen.add(href);
    next.push(linkFromArticle(match));
    if (next.length >= 3) break;
  }

  for (const related of article.related) {
    if (next.length >= 3) break;
    if (seen.has(related.href)) continue;
    if (!related.href.startsWith("/diamond-guide/")) continue;
    seen.add(related.href);
    next.push({ title: related.title, href: related.href });
  }

  return {
    articles: next.slice(0, 3),
    studio: shouldSurfaceStudio(article) ? STUDIO_TOOL : null,
  };
}

export function articleVisualBreadcrumbs(article: Article): GuideBreadcrumbItem[] {
  const crumbs: GuideBreadcrumbItem[] = [
    { name: "Diamond Guide", href: "/diamond-guide" },
  ];

  const group = GUIDE_NAV_GROUPS.find(
    (item) => item.articleCategory === article.category,
  );
  if (group) {
    crumbs.push({ name: group.navTitle, href: group.href });
  } else {
    const segment = articleCategorySegment(article.category);
    if (segment) {
      const hub = DIAMOND_GUIDE_CATEGORIES.find((item) => item.segment === segment);
      crumbs.push({
        name: hub?.navTitle ?? article.category,
        href: `/diamond-guide/${segment}`,
      });
    }
  }

  crumbs.push({ name: article.title });
  return crumbs;
}

export function categoryPreviewArticles(
  group: GuideNavGroup,
  limit = 4,
): GuideArticleSummary[] {
  return orderedArticlesForGroup(group).slice(0, limit).map(toSummary);
}

export function hubCategoryPreviews() {
  return guideHubCategories().map((group) => ({
    group,
    articles: categoryPreviewArticles(group),
  }));
}
