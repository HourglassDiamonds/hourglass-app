/**
 * Bounded URL inventory for P1-TECH-1 Technical SEO closeout.
 * Read-only constants — no network, no writes.
 */

import { articles } from "@/app/diamond-guide/articles";
import type { TechSeoInventoryItem } from "./types";

/** Representative Diamond Guide articles for canonical / indexability sampling. */
export const REPRESENTATIVE_GUIDE_SLUGS = [
  "how-to-read-a-diamond-certificate",
  "natural-vs-lab-diamonds",
  "what-is-diamond-fluorescence",
  "charlotte-diamond-advisor-guide",
  "what-is-diamond-cut",
] as const;

export function buildP1Tech1Inventory(): TechSeoInventoryItem[] {
  const commercial: TechSeoInventoryItem[] = [
    {
      path: "/",
      label: "Home",
      kind: "home",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/page.tsx",
    },
    {
      path: "/ledger",
      label: "Ledger",
      kind: "editorial-hub",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/ledger/page.tsx",
    },
    {
      path: "/diamond-intelligence",
      label: "Diamond Intelligence",
      kind: "tool",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/diamond-intelligence/layout.tsx",
    },
    {
      path: "/diamond-studio",
      label: "Diamond Size Studio",
      kind: "tool",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/diamond-studio/layout.tsx",
    },
    {
      path: "/diamond-shape-studio",
      label: "See It On Your Hand",
      kind: "tool",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/diamond-shape-studio/layout.tsx",
    },
    {
      path: "/engagement-rings",
      label: "Engagement Rings",
      kind: "commercial",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/engagement-rings/page.tsx",
    },
    {
      path: "/custom-design",
      label: "Custom Design",
      kind: "commercial",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/custom-design/page.tsx",
    },
    {
      path: "/concierge",
      label: "Concierge",
      kind: "commercial",
      expectedInSitemap: true,
      indexIntent: "index",
      metadataSourceFile: "app/concierge/page.tsx",
    },
    {
      path: "/privacy",
      label: "Privacy",
      kind: "legal",
      expectedInSitemap: "undeclared",
      indexIntent: "undeclared",
      metadataSourceFile: "app/privacy/page.tsx",
    },
    {
      path: "/terms",
      label: "Terms",
      kind: "legal",
      expectedInSitemap: "undeclared",
      indexIntent: "undeclared",
      metadataSourceFile: "app/terms/page.tsx",
    },
  ];

  const guides: TechSeoInventoryItem[] = [];
  for (const slug of REPRESENTATIVE_GUIDE_SLUGS) {
    const exists = articles.some((a) => a.slug === slug);
    guides.push({
      path: `/diamond-guide/${slug}`,
      label: `Diamond Guide: ${slug}`,
      kind: "guide",
      expectedInSitemap: exists,
      indexIntent: exists ? "index" : "undeclared",
      metadataSourceFile: exists
        ? "app/diamond-guide/[slug]/page.tsx + lib/seo/diamond-guide-metadata.ts"
        : null,
    });
  }

  return [...commercial, ...guides];
}
