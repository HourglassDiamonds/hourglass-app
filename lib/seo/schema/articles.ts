import type { Article } from "@/app/diamond-guide/articles";
import { articleMetaDescription } from "@/lib/seo/article-description";
import { articleCategorySegment } from "./category-map";
import { articleBreadcrumb } from "./breadcrumbs";
import { absoluteUrl, WEBSITE_ID } from "./constants";
import {
  organizationPublisherReference,
  personAuthorReference,
} from "./entities";
import { jsonLdGraph, type JsonLdValue } from "./json-ld";

function buildArticleNode(article: Article): JsonLdValue {
  const path = `/diamond-guide/${article.slug}`;
  const description = articleMetaDescription(article.body);

  const node: JsonLdValue = {
    "@type": "Article",
    "@id": `${absoluteUrl(path)}#article`,
    headline: article.title,
    name: article.title,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    author: personAuthorReference(),
    publisher: organizationPublisherReference(),
    isPartOf: {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
    },
    about: {
      "@type": "Thing",
      name: article.category,
    },
  };

  return node;
}

export function buildArticlePageJsonLd(article: Article): JsonLdValue {
  const categorySegment = articleCategorySegment(article.category);

  return jsonLdGraph([
    buildArticleNode(article),
    articleBreadcrumb({
      title: article.title,
      slug: article.slug,
      categorySegment,
    }),
  ]);
}

export function buildAllArticlePageJsonLd(
  articleList: Article[],
): JsonLdValue[] {
  return articleList.map((article) => buildArticlePageJsonLd(article));
}
