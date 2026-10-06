import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articles } from "./articles";
import { LAB_NATURAL_FAQS } from "@/lib/seo/lab-natural-educational";

const DIAMOND_INTELLIGENCE_PATH = "/diamond-intelligence";
const SUPPORTED_SCOPE =
  "an original GIA, IGI, or supported GCAL grading report PDF for a round brilliant";

function articleParagraphs() {
  return articles.flatMap((article) =>
    article.body
      .filter((block) => block.type === "paragraph")
      .map((block) => ({ slug: article.slug, text: block.text })),
  );
}

describe("Diamond Guide trust copy", () => {
  it("scopes every Guide link to Diamond Intelligence to supported reports", () => {
    const linked = articleParagraphs().filter(({ text }) =>
      text.includes(DIAMOND_INTELLIGENCE_PATH),
    );

    assert.ok(linked.length > 0);
    for (const { slug, text } of linked) {
      assert.match(text, new RegExp(SUPPORTED_SCOPE, "i"), slug);
    }
  });

  it("does not promise unsupported DI analysis", () => {
    const guideCopy = articleParagraphs()
      .map(({ text }) => text)
      .join("\n");

    assert.doesNotMatch(
      guideCopy,
      /Diamond Intelligence[^\n]*(?:reviewing a fancy shape|specific HRD report|truly eye clean|use it to help interpret)[^\n]*/i,
    );
    assert.match(guideCopy, /does not currently support HRD reports/i);
    assert.match(guideCopy, /cannot analyze a report number alone/i);
  });

  it("uses the current GIA laboratory-grown service date and terminology", () => {
    const publicCopy = [
      ...articleParagraphs().map(({ text }) => text),
      ...LAB_NATURAL_FAQS.map(({ answer }) => answer),
    ].join("\n");

    assert.doesNotMatch(publicCopy, /As of June 2024/i);
    assert.match(publicCopy, /October 1, 2025/i);
    assert.match(publicCopy, /Premium or Standard/i);
    assert.match(publicCopy, /Older GIA laboratory-grown reports/i);
  });
});
