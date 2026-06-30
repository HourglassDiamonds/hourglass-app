import type { Article } from "@/app/diamond-guide/articles";
import { absoluteUrl } from "@/lib/seo/schema/constants";

/**
 * Diamond Guide article imagery — centralized paths, sizing, and live/pending gates.
 *
 * Asset guidelines:
 * - Hero: 1600×1000 (16:10 editorial ratio), JPG or WebP, quiet luxury tone
 * - OG: 1200×630, distinct crop when hero is not suitable for social previews
 * - Alt text: descriptive, specific — never generic "diamond ring" stock language
 * - Store under public/diamond-guide/{slug}-hero.jpg and {slug}-og.jpg
 *
 * Flip enableHeroImagery and set visualStatus: "live" on target articles when assets ship.
 */
export type ArticleVisualCategory =
  | "original-photo"
  | "editorial-graphic"
  | "comparison-visual"
  | "tool-screenshot"
  | "video-still";

export type ArticleVisualStatus = "pending" | "live";

export const ARTICLE_IMAGERY = {
  /** When false, hero UI and article-specific OG/JSON-LD images stay off even if metadata exists. */
  enableHeroImagery: true,
  /** Base directory under public/ for article hero and OG assets. */
  basePath: "/diamond-guide",
} as const;

export const ARTICLE_HERO_IMAGE_SPECS = {
  width: 1600,
  height: 1000,
  aspectRatio: "16:10" as const,
} as const;

export const ARTICLE_OG_IMAGE_SPECS = {
  width: 1200,
  height: 630,
} as const;

export function isArticleVisualLive(article: Article): boolean {
  return (
    ARTICLE_IMAGERY.enableHeroImagery &&
    article.visualStatus === "live" &&
    Boolean(article.heroImage || article.ogImage)
  );
}

export function resolveArticleHeroImage(article: Article): {
  src: string;
  alt: string;
  caption?: string;
} | null {
  if (!isArticleVisualLive(article) || !article.heroImage || !article.heroImageAlt) {
    return null;
  }

  return {
    src: article.heroImage,
    alt: article.heroImageAlt,
    caption: article.heroImageCaption,
  };
}

/** Public path for article-specific OG image, or null when not live or unset. */
export function resolveArticleOgImagePath(article: Article): string | null {
  if (!isArticleVisualLive(article) || !article.ogImage) {
    return null;
  }

  return article.ogImage;
}

/** Absolute URL for Article JSON-LD `image` — hero when live; OG only if no hero. */
export function resolveArticleJsonLdImageUrl(article: Article): string | null {
  if (!isArticleVisualLive(article)) {
    return null;
  }

  const path = article.heroImage ?? article.ogImage ?? null;
  return path ? absoluteUrl(path) : null;
}
