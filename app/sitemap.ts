import type { MetadataRoute } from "next";
import { articles } from "@/app/diamond-guide/articles";
import { LEDGER_INDEXES } from "@/app/ledger/ledger-data";
import { DIAMOND_GUIDE_CATEGORIES } from "@/lib/seo/diamond-guide-metadata";
import { SITE_URL } from "@/lib/seo/site-metadata";

const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const corePages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1, lastModified },
    { url: `${SITE_URL}/the-house`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/our-approach`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/engagement-rings`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/custom-design`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/concierge`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/diamond-studio`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/diamond-intelligence`, priority: 0.9, lastModified },
    { url: `${SITE_URL}/diamond-guide`, priority: 0.85, lastModified },
    { url: `${SITE_URL}/whispered-praise`, priority: 0.85, lastModified },
    { url: `${SITE_URL}/ledger`, priority: 0.75, lastModified },
  ];

  const ledgerIndexPages: MetadataRoute.Sitemap = LEDGER_INDEXES.map(
    (index) => ({
      url: `${SITE_URL}/ledger/${index.slug}`,
      priority: 0.7,
      lastModified,
    }),
  );

  const categoryPages: MetadataRoute.Sitemap = DIAMOND_GUIDE_CATEGORIES.flatMap(
    (category) => [
      {
        url: `${SITE_URL}/diamond-guide/${category.segment}`,
        priority: 0.8,
        lastModified,
      },
      {
        url: `${SITE_URL}/diamond-guide/${category.segment}/all`,
        priority: 0.75,
        lastModified,
      },
    ],
  );

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/diamond-guide/${article.slug}`,
    priority: 0.7,
    lastModified,
  }));

  return [...corePages, ...ledgerIndexPages, ...categoryPages, ...articlePages];
}
