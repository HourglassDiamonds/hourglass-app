import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articles } from "@/app/diamond-guide/articles";
import { DIAMOND_GUIDE_CATEGORIES } from "@/lib/seo/diamond-guide-metadata";
import { articleCategorySegment } from "@/lib/seo/schema/category-map";
import { reconstructSitemapPaths } from "@/lib/agent-os/search/tech-seo/sitemap-audit";
import { buildArticlePageJsonLd } from "@/lib/seo/schema/articles";
import { serializeJsonLd } from "@/lib/seo/schema/json-ld";
import { PREVIEW_SLUGS } from "./guide-nav";
import {
  BUYING_PATH,
  articleVisualBreadcrumbs,
  articlesForGroup,
  buildGuideSearchIndex,
  categoryVisualBreadcrumbs,
  groupedGuideLibrary,
  guideHubCategories,
  orderedArticlesForSegment,
  resolveRelatedReading,
  searchGuideArticles,
  uncategorizedArticles,
} from "./guide-architecture";

describe("Diamond Guide architecture", () => {
  it("indexes every article exactly once across nav groups", () => {
    const grouped = groupedGuideLibrary();
    const hrefs = grouped.flatMap((entry) =>
      entry.articles.map((article) => article.href),
    );
    assert.equal(hrefs.length, articles.length);
    assert.equal(new Set(hrefs).size, articles.length);
    assert.equal(uncategorizedArticles().length, 0);
  });

  it("places every article in exactly one recognized primary category", () => {
    const labels = new Set(
      DIAMOND_GUIDE_CATEGORIES.map((category) => category.articleCategory),
    );
    const unknown = articles.filter((article) => !labels.has(article.category));
    const unmapped = articles.filter(
      (article) => articleCategorySegment(article.category) === null,
    );

    assert.equal(unknown.length, 0);
    assert.equal(unmapped.length, 0);
    assert.equal(uncategorizedArticles().length, 0);

    for (const article of articles) {
      const matches = DIAMOND_GUIDE_CATEGORIES.filter(
        (category) => category.articleCategory === article.category,
      );
      assert.equal(matches.length, 1, article.slug);
    }
  });

  it("keeps derived category counts identical to the article registry", () => {
    const grouped = groupedGuideLibrary();
    assert.equal(grouped.length, DIAMOND_GUIDE_CATEGORIES.length);

    for (const category of DIAMOND_GUIDE_CATEGORIES) {
      const registryCount = articles.filter(
        (article) => article.category === category.articleCategory,
      ).length;
      const group = grouped.find((entry) => entry.group.id === category.segment);
      assert.ok(group, category.segment);
      assert.equal(group!.articles.length, registryCount);
      assert.equal(
        articlesForGroup(group!.group).length,
        registryCount,
      );
      assert.equal(
        orderedArticlesForSegment(category.segment).length,
        registryCount,
      );
      assert.ok(registryCount > 0, `orphaned category: ${category.segment}`);
    }
  });

  it("exposes every official hub, including Charlotte, on the Guide and master index", () => {
    const hubs = guideHubCategories();
    const ids = groupedGuideLibrary().map((entry) => entry.group.id);

    assert.equal(hubs.length, DIAMOND_GUIDE_CATEGORIES.length);
    assert.equal(ids.length, DIAMOND_GUIDE_CATEGORIES.length);
    assert.ok(hubs.some((group) => group.id === "charlotte-guides"));
    assert.ok(ids.includes("buying-strategy"));
    assert.ok(ids.includes("charlotte-guides"));
    assert.ok(ids.includes("proposal-planning"));
    assert.equal(
      articleCategorySegment("Charlotte Guides"),
      "charlotte-guides",
    );
    assert.equal(articleCategorySegment("Buying Guides"), "buying-strategy");

    const charlotte = hubs.find((group) => group.id === "charlotte-guides");
    assert.equal(charlotte?.href, "/diamond-guide/charlotte-guides");
    assert.equal(charlotte?.title, "Charlotte Guides");
  });

  it("keeps preview ordering inside the registry rather than duplicating article sets", () => {
    for (const [segment, slugs] of Object.entries(PREVIEW_SLUGS)) {
      const assigned = new Set(
        orderedArticlesForSegment(
          segment as (typeof DIAMOND_GUIDE_CATEGORIES)[number]["segment"],
        ).map((article) => article.slug),
      );
      for (const slug of slugs) {
        assert.ok(assigned.has(slug), `${segment} preview missing ${slug}`);
      }
    }
  });

  it("search matches useful consumer queries across title, category, excerpt, and aliases", () => {
    const index = buildGuideSearchIndex();

    const color = searchGuideArticles("diamond color", index);
    assert.ok(color.some((item) => item.slug === "what-is-diamond-color"));

    const fluorescence = searchGuideArticles("fluorescence", index);
    assert.ok(
      fluorescence.some((item) => item.slug === "what-is-diamond-fluorescence"),
    );

    const oval = searchGuideArticles("oval", index);
    assert.ok(oval.some((item) => item.slug === "oval-diamond-guide"));

    const carat = searchGuideArticles("carat weight", index);
    assert.ok(carat.some((item) => item.slug === "what-is-a-carat"));

    const clarity = searchGuideArticles("vs1 vs vs2", index);
    assert.ok(clarity.some((item) => item.slug === "vs1-vs-vs2-diamond-clarity"));

    const origin = searchGuideArticles("lab grown", index);
    assert.ok(origin.some((item) => item.slug === "natural-vs-lab-diamonds"));

    const charlotte = searchGuideArticles("charlotte", index);
    assert.ok(
      charlotte.some((item) => item.slug === "charlotte-diamond-advisor-guide"),
    );

    const buying = searchGuideArticles("buying strategy", index);
    assert.ok(buying.some((item) => item.category === "Buying Guides"));

    const certs = searchGuideArticles("diamond certificates", index);
    assert.ok(
      certs.some((item) => item.slug === "how-to-read-a-diamond-certificate"),
    );
  });

  it("returns no results for an empty or unmatched query", () => {
    const index = buildGuideSearchIndex();
    assert.deepEqual(searchGuideArticles("   ", index), []);
    assert.deepEqual(searchGuideArticles("xyzzy-not-a-guide", index), []);
  });

  it("buying path points at existing articles and Diamond Studio", () => {
    for (const step of BUYING_PATH) {
      if (step.kind === "tool") {
        assert.equal(step.href, "/diamond-studio");
        continue;
      }
      const slug = step.href.replace("/diamond-guide/", "");
      assert.ok(
        articles.some((article) => article.slug === slug),
        `missing buying-path article: ${slug}`,
      );
    }
  });

  it("related reading returns about three subject-linked articles", () => {
    const color = articles.find((article) => article.slug === "what-is-diamond-color");
    assert.ok(color);
    const related = resolveRelatedReading(color!);
    assert.equal(related.articles.length, 3);
    assert.ok(
      related.articles.some((item) => item.href.includes("what-is-diamond-cut")),
    );
    assert.ok(
      related.articles.some((item) =>
        item.href.includes("what-is-diamond-fluorescence"),
      ),
    );
    assert.equal(related.studio, null);
  });

  it("surfaces Diamond Studio on size, shape, and carat articles only", () => {
    const size = articles.find((article) => article.slug === "what-is-a-carat");
    const cert = articles.find(
      (article) => article.slug === "how-to-read-a-diamond-certificate",
    );
    assert.ok(size && cert);
    assert.equal(resolveRelatedReading(size!).studio?.href, "/diamond-studio");
    assert.equal(resolveRelatedReading(cert!).studio, null);
  });

  it("builds Diamond Guide → Category → Article breadcrumbs", () => {
    const color = articles.find((article) => article.slug === "what-is-diamond-color");
    assert.ok(color);
    const crumbs = articleVisualBreadcrumbs(color!);
    assert.equal(crumbs[0]?.href, "/diamond-guide");
    assert.equal(crumbs[1]?.href, "/diamond-guide/diamond-color");
    assert.equal(crumbs[2]?.name, color!.title);
    assert.equal(crumbs[2]?.href, undefined);
  });

  it("sends Charlotte articles to the Charlotte hub rather than the master index", () => {
    const article = articles.find(
      (item) => item.slug === "charlotte-diamond-advisor-guide",
    );
    assert.ok(article);
    const crumbs = articleVisualBreadcrumbs(article!);
    assert.equal(crumbs[1]?.name, "Charlotte Guides");
    assert.equal(crumbs[1]?.href, "/diamond-guide/charlotte-guides");
  });

  it("builds category hub and index breadcrumbs from the same registry", () => {
    const hub = categoryVisualBreadcrumbs("diamond-color", "hub");
    assert.equal(hub[0]?.href, "/diamond-guide");
    assert.equal(hub[1]?.name, "Color");
    assert.equal(hub[1]?.href, undefined);

    const index = categoryVisualBreadcrumbs("diamond-color", "index");
    assert.equal(index[1]?.href, "/diamond-guide/diamond-color");
    assert.equal(index[2]?.name, "All Diamond Color Guides");

    const charlotte = categoryVisualBreadcrumbs("charlotte-guides", "hub");
    assert.equal(charlotte[1]?.name, "Charlotte Guides");
  });

  it("includes every category hub and /all route in the sitemap reconstruction", () => {
    const { paths } = reconstructSitemapPaths();
    for (const category of DIAMOND_GUIDE_CATEGORIES) {
      assert.ok(paths.includes(`/diamond-guide/${category.segment}`));
      assert.ok(paths.includes(`/diamond-guide/${category.segment}/all`));
    }
    assert.ok(paths.includes("/diamond-guide/charlotte-guides"));
    assert.ok(paths.includes("/diamond-guide/charlotte-guides/all"));
  });

  it("emits Charlotte article breadcrumbs to the Charlotte hub", () => {
    const article = articles.find(
      (item) => item.slug === "charlotte-diamond-advisor-guide",
    );
    assert.ok(article);
    const serialized = serializeJsonLd(buildArticlePageJsonLd(article!));
    assert.match(serialized, /charlotte-guides/);
    assert.doesNotMatch(serialized, /all#charlotte-guides/);
  });
});
