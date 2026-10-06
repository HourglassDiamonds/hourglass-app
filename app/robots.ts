import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site-metadata";
import { CRAWLER_DISALLOW_PATHS } from "@/lib/seo/public-indexing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...CRAWLER_DISALLOW_PATHS],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
