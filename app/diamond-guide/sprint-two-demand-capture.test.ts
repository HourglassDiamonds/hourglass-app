import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articleMetaDescription } from "@/lib/seo/article-description";
import { articles, type Article } from "./articles";

const TARGETS = {
  "g-vs-h-diamond-color": "G vs H Diamond Color: Which Should You Choose?",
  "d-vs-e-vs-f-diamond-color":
    "D vs E vs F Diamond Color: Is the Difference Visible?",
  "hrd-diamond-certification-explained":
    "HRD Diamond Certification: What the Report Means",
  "how-lighting-affects-diamonds":
    "How Lighting Affects Diamond Sparkle and Color",
  "diamond-cut-vs-polish-vs-symmetry":
    "Diamond Cut vs Polish vs Symmetry: Key Differences",
  "does-fluorescence-affect-diamond-value":
    "Does Fluorescence Affect Diamond Value?",
} as const;

function targetArticle(slug: keyof typeof TARGETS): Article {
  const article = articles.find((item) => item.slug === slug);
  assert.ok(article, `Missing Sprint 2 article: ${slug}`);
  return article;
}

describe("Sprint 2 existing-demand capture", () => {
  it("keeps the approved six-URL scope and query-aligned titles", () => {
    for (const [slug, title] of Object.entries(TARGETS)) {
      assert.equal(targetArticle(slug as keyof typeof TARGETS).title, title);
    }
  });

  it("opens each article with an answer-first meta description", () => {
    for (const slug of Object.keys(TARGETS) as (keyof typeof TARGETS)[]) {
      const description = articleMetaDescription(targetArticle(slug).body);
      assert.ok(description.length >= 80, `${slug}: description is too short`);
      assert.ok(description.length <= 160, `${slug}: description is too long`);
      assert.doesNotMatch(description, /^(For|This article|Value context)/);
    }
  });

  it("provides one complete, readable comparison table per article", () => {
    for (const slug of Object.keys(TARGETS) as (keyof typeof TARGETS)[]) {
      const tables = targetArticle(slug).body.filter(
        (block) => block.type === "comparison-table",
      );
      assert.equal(tables.length, 1, `${slug}: expected one comparison table`);
      const table = tables[0]!;
      assert.ok(table.columns.length >= 3, `${slug}: insufficient columns`);
      assert.ok(table.rows.length >= 3, `${slug}: insufficient rows`);
      for (const row of table.rows) {
        assert.equal(
          row.cells.length,
          table.columns.length,
          `${slug}: table row does not match column count`,
        );
      }
    }
  });

  it("includes internal decision paths and primary-source support", () => {
    for (const slug of Object.keys(TARGETS) as (keyof typeof TARGETS)[]) {
      const copy = targetArticle(slug).body
        .filter((block) => block.type === "paragraph")
        .map((block) => block.text)
        .join("\n");
      assert.match(copy, /\]\(\/diamond-guide\//, `${slug}: internal link`);
      assert.match(copy, /Source basis:/, `${slug}: source label`);
      assert.match(copy, /\]\(https:\/\//, `${slug}: external source link`);
    }
  });

  it("preserves Hourglass judgment requirements", () => {
    const cutCopy = targetArticle("diamond-cut-vs-polish-vs-symmetry").body
      .filter((block) => block.type === "paragraph")
      .map((block) => block.text)
      .join("\n");
    assert.match(
      cutCopy,
      /Hourglass requires Excellent cut, polish, and symmetry as an initial screening floor/,
    );
    assert.match(cutCopy, /does not independently prove exceptional beauty/);

    for (const slug of [
      "g-vs-h-diamond-color",
      "d-vs-e-vs-f-diamond-color",
    ] as const) {
      assert.ok(
        targetArticle(slug).body.some(
          (block) =>
            block.type === "heading" &&
            block.text === "What Justin Would Inspect Next",
        ),
        `${slug}: missing Justin inspection guidance`,
      );
    }
  });
});
