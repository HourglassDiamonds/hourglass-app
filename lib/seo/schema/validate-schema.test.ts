import { describe, expect, it } from "vitest";
import { articles } from "@/app/diamond-guide/articles";
import { buildArticlePageJsonLd } from "./articles";
import {
  buildGlobalSiteJsonLd,
  diamondIntelligenceApplicationNode,
  diamondIntelligenceFaqNode,
  diamondStudioApplicationNode,
  diamondStudioFaqNode,
  diamondStudioWebPageNode,
  engagementRingsFaqNode,
  globalEntityGraph,
} from "./entities";
import {
  diamondIntelligenceBreadcrumb,
  diamondStudioBreadcrumb,
  marketingPageBreadcrumb,
} from "./breadcrumbs";
import { jsonLdGraph, serializeJsonLd } from "./json-ld";
import { DIAMOND_STUDIO_FAQS } from "@/lib/seo/diamond-studio-educational";

function graphTypes(data: unknown): string[] {
  if (
    typeof data !== "object" ||
    data === null ||
    !("@graph" in data) ||
    !Array.isArray((data as { "@graph": unknown[] })["@graph"])
  ) {
    const type = (data as { "@type"?: string | string[] })["@type"];
    return type ? [Array.isArray(type) ? type.join(",") : type] : [];
  }

  return (data as { "@graph": { "@type"?: string | string[] }[] })["@graph"].flatMap(
    (node) => {
      const type = node["@type"];
      if (!type) return [];
      return Array.isArray(type) ? type : [type];
    },
  );
}

describe("structured data builders", () => {
  it("emits global entity graph with required types", () => {
    const data = buildGlobalSiteJsonLd();
    const types = graphTypes(data);

    expect(types).toContain("Organization");
    expect(types).toContain("Person");
    expect(types).toContain("WebSite");
    expect(types).toContain("LocalBusiness");
    expect(types).toContain("JewelryStore");
    expect(globalEntityGraph()).toHaveLength(4);
  });

  it("serializes article graphs for every diamond guide article", () => {
    expect(articles.length).toBeGreaterThan(0);

    for (const article of articles) {
      const payload = buildArticlePageJsonLd(article);
      const types = graphTypes(payload);
      expect(types).toContain("Article");
      expect(types).toContain("BreadcrumbList");
      expect(serializeJsonLd(payload)).not.toContain("<");
    }
  });

  it("omits publication dates when article data has none", () => {
    const sample = buildArticlePageJsonLd(articles[0]!);
    const graph = (sample as { "@graph": Record<string, unknown>[] })["@graph"];
    const articleNode = graph.find((node) => node["@type"] === "Article");

    expect(articleNode).toBeDefined();
    expect(articleNode).not.toHaveProperty("datePublished");
    expect(articleNode).not.toHaveProperty("dateModified");
  });

  it("omits image property when article visual is pending", () => {
    const withoutVisual = articles.find((article) => !article.visualStatus);
    expect(withoutVisual).toBeDefined();

    const payload = buildArticlePageJsonLd(withoutVisual!);
    const graph = (payload as { "@graph": Record<string, unknown>[] })["@graph"];
    const articleNode = graph.find((node) => node["@type"] === "Article");

    expect(articleNode).toBeDefined();
    expect(articleNode).not.toHaveProperty("image");
  });

  it("emits image property only for live article visuals", () => {
    const liveSlugs = new Set([
      "charlotte-diamond-advisor-guide",
      "how-to-read-a-diamond-certificate",
      "natural-vs-lab-diamonds",
      "oval-vs-round-diamond",
      "asscher-diamond-guide",
      "cushion-diamond-guide",
      "custom-engagement-rings-in-charlotte",
      "diamond-carat-vs-size",
      "diamond-light-return-explained",
      "diamond-size-chart",
      "emerald-diamond-guide",
      "gia-diamond-certification-explained",
      "independent-diamond-advisor-vs-jewelry-store",
      "marquise-diamond-guide",
      "oval-diamond-guide",
      "pear-diamond-guide",
      "princess-diamond-guide",
      "radiant-diamond-guide",
      "round-diamond-guide",
      "what-is-diamond-fluorescence",
      "when-fluorescence-improves-a-diamond",
      "fluorescence-in-natural-vs-lab-diamonds",
      "why-work-with-a-graduate-gemologist",
    ]);

    for (const article of articles) {
      const payload = buildArticlePageJsonLd(article);
      const graph = (payload as { "@graph": Record<string, unknown>[] })["@graph"];
      const articleNode = graph.find((node) => node["@type"] === "Article");

      if (liveSlugs.has(article.slug)) {
        expect(articleNode?.image).toBeTruthy();
      } else {
        expect(articleNode).not.toHaveProperty("image");
      }
    }
  });

  it("emits Diamond Intelligence application, FAQ, and breadcrumb graph", () => {
    const payload = jsonLdGraph([
      diamondIntelligenceApplicationNode(),
      diamondIntelligenceFaqNode(),
      diamondIntelligenceBreadcrumb(),
    ]);
    const types = graphTypes(payload);

    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    expect(serializeJsonLd(payload)).toContain("diamond-intelligence");
  });

  it("emits Diamond Size Studio webpage, application, FAQ, and breadcrumb graph", () => {
    const payload = jsonLdGraph([
      diamondStudioWebPageNode(),
      diamondStudioApplicationNode(),
      diamondStudioFaqNode(),
      diamondStudioBreadcrumb(),
    ]);
    const types = graphTypes(payload);
    const serialized = serializeJsonLd(payload);

    expect(types).toContain("WebPage");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    expect(serialized).toContain("diamond-studio");
    expect(serialized).toContain("creator");
    for (const faq of DIAMOND_STUDIO_FAQS) {
      expect(serialized).toContain(faq.question);
    }
  });

  it("emits engagement rings FAQ and breadcrumb graph", () => {
    const payload = jsonLdGraph([
      marketingPageBreadcrumb("Engagement Rings", "/engagement-rings"),
      engagementRingsFaqNode(),
    ]);
    const types = graphTypes(payload);

    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    expect(serializeJsonLd(payload)).toContain("engagement-rings");
  });
});
