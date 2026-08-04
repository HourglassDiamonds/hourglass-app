import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInlineContent } from "@/app/diamond-guide/inline-content";

describe("renderInlineContent Concierge attribution", () => {
  it("converts bare /concierge links with article slug attribution", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineContent("Talk with [Concierge](/concierge) today.", {
        articleSlug: "what-is-diamond-cut",
      })}</>,
    );
    assert.match(html, /href="\/concierge\?/);
    assert.match(html, /tool=diamond-guide/);
    assert.match(html, /content=what-is-diamond-cut/);
    assert.match(html, /location=guide_article%3Ainline|location=guide_article:inline/);
    assert.match(html, />Concierge</);
  });

  it("leaves non-Concierge article links unchanged", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineContent(
        "See the [Size Studio](/diamond-studio) and [shapes](/diamond-guide/diamond-shapes).",
        { articleSlug: "what-is-diamond-cut" },
      )}</>,
    );
    assert.match(html, /href="\/diamond-studio"/);
    assert.match(html, /href="\/diamond-guide\/diamond-shapes"/);
    assert.doesNotMatch(html, /tool=diamond-guide/);
  });

  it("does not rewrite bare /concierge without an article slug", () => {
    const html = renderToStaticMarkup(
      <>{renderInlineContent("Talk with [Concierge](/concierge) today.")}</>,
    );
    assert.match(html, /href="\/concierge"/);
    assert.doesNotMatch(html, /tool=/);
  });
});
