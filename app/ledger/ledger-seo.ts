import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/site-metadata";
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo/schema/constants";
import { jsonLdGraph, type JsonLdGraph } from "@/lib/seo/schema/json-ld";

export const LEDGER_HUB_PATH = "/ledger";
export const LEDGER_HUB_NAME = "The Ledger";
export const LEDGER_HUB_DESCRIPTION =
  "Hourglass Diamonds' editorial systems-monitoring publication, tracking pressure across infrastructure, technology, materials, resources, and economic buffers.";

const LEDGER_HUB_ID = `${absoluteUrl(LEDGER_HUB_PATH)}#webpage`;

function ledgerTitle(topic?: string): string {
  return topic
    ? `${topic} | Ledger | Hourglass Diamonds`
    : "Ledger: Systems Monitoring | Hourglass Diamonds";
}

export function ledgerMetadata(input: {
  path: string;
  description: string;
  topic?: string;
}): Metadata {
  const title = ledgerTitle(input.topic);

  return {
    title: { absolute: title },
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Hourglass Diamonds",
      title,
      description: input.description,
      url: input.path,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

function breadcrumbItems(currentName?: string, currentPath?: string) {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Ledger",
      item: absoluteUrl(LEDGER_HUB_PATH),
    },
  ];

  if (currentName && currentPath) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: currentName,
      item: absoluteUrl(currentPath),
    });
  }

  return items;
}

export function buildLedgerHubJsonLd(
  monitors: readonly { name: string; path: string }[],
): JsonLdGraph {
  return jsonLdGraph([
    {
      "@type": "CollectionPage",
      "@id": LEDGER_HUB_ID,
      url: absoluteUrl(LEDGER_HUB_PATH),
      name: LEDGER_HUB_NAME,
      alternateName: "Hourglass Ledger",
      description: LEDGER_HUB_DESCRIPTION,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      breadcrumb: { "@id": `${absoluteUrl(LEDGER_HUB_PATH)}#breadcrumb` },
      hasPart: monitors.map((monitor) => ({
        "@type": "WebPage",
        "@id": `${absoluteUrl(monitor.path)}#webpage`,
        url: absoluteUrl(monitor.path),
        name: monitor.name,
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${absoluteUrl(LEDGER_HUB_PATH)}#breadcrumb`,
      itemListElement: breadcrumbItems(),
    },
  ]);
}

export function buildLedgerMonitorJsonLd(input: {
  name: string;
  path: string;
  description: string;
}): JsonLdGraph {
  return jsonLdGraph([
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(input.path)}#webpage`,
      url: absoluteUrl(input.path),
      name: input.name,
      description: input.description,
      isPartOf: { "@id": LEDGER_HUB_ID },
      publisher: { "@id": ORGANIZATION_ID },
      breadcrumb: { "@id": `${absoluteUrl(input.path)}#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${absoluteUrl(input.path)}#breadcrumb`,
      itemListElement: breadcrumbItems(input.name, input.path),
    },
  ]);
}
