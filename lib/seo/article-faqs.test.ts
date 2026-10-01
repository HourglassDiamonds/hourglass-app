import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { articleFaqsForSlug } from "./article-faqs";

const FAQ_SLUGS = [
  "charlotte-diamond-advisor-guide",
  "how-to-read-a-diamond-certificate",
  "natural-vs-lab-diamonds",
  "what-is-diamond-fluorescence",
  "what-is-diamond-clarity",
  "what-is-diamond-color",
  "what-is-diamond-cut",
] as const;

describe("Diamond Guide FAQ visibility", () => {
  it("provides visible FAQ copy for every article that emits FAQ schema", () => {
    for (const slug of FAQ_SLUGS) {
      const faqs = articleFaqsForSlug(slug);
      assert.ok(faqs.length > 0, `${slug} should have visible FAQ items`);
      for (const faq of faqs) {
        assert.ok(faq.question.length > 0);
        assert.ok(faq.answer.length > 0);
      }
    }
  });

  it("renders the shared FAQ mapping on article pages", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/diamond-guide/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(pageSource, /articleFaqsForSlug\(slug\)/);
    assert.match(pageSource, /<ArticleFaqSection items=\{articleFaqs\}/);
  });
});
