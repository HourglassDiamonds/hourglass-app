import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CONSULTATION_CTA_EVENT,
  buildConciergeHref,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";
import {
  armClientAnalytics,
  resetClientAnalyticsForTests,
} from "@/lib/gtag";

const pageSource = readFileSync(
  path.join(process.cwd(), "app/diamond-studio/page.tsx"),
  "utf8",
);
const handoffSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/DiamondStudioHandoff.tsx",
  ),
  "utf8",
);
const editorialSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/DiamondStudioEditorial.tsx",
  ),
  "utf8",
);
const editorialContactSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/DiamondStudioEditorialContact.tsx",
  ),
  "utf8",
);
const shareSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/ShareStudioView.tsx",
  ),
  "utf8",
);

describe("Diamond Size Studio post-insight handoff", () => {
  it("places the handoff after the Studio instrument and before editorial", () => {
    const handoff = pageSource.indexOf("<DiamondStudioHandoff");
    const editorial = pageSource.indexOf("<DiamondStudioEditorial");
    const hero = pageSource.indexOf("dts-mobile-hero");
    assert.ok(handoff > 0, "DiamondStudioHandoff missing from page");
    assert.ok(editorial > 0, "editorial missing from page");
    assert.ok(hero > 0, "stage hero missing");
    assert.ok(handoff < editorial, "handoff must precede editorial");
    assert.ok(hero < handoff, "handoff must follow stage chrome, not sit in it");
    assert.match(pageSource, /<DiamondStudioHandoff\s*\/>/);
  });

  it("removes the helper-style stage CTA from Size Studio chrome", () => {
    assert.doesNotMatch(pageSource, /Begin the Conversation/);
    assert.doesNotMatch(pageSource, /trackConsultationCtaClicked/);
    assert.doesNotMatch(pageSource, /buildConciergeHref/);
    assert.match(pageSource, /<ShareStudioView/);
    assert.match(pageSource, /dts-shape-strip/);
    assert.match(shareSource, /Share this view/);
  });

  it("keeps editorial contact as a separate non-consultation-primary CTA", () => {
    assert.match(editorialSource, /DiamondStudioEditorialContact/);
    assert.doesNotMatch(editorialSource, /Begin the Conversation/);
    assert.match(editorialContactSource, /Request a comparison or image/);
  });

  it("reuses Concierge attribution without a parallel form or new event", () => {
    const href = buildConciergeHref({
      tool: "diamond-studio",
      params: { location: "diamond_studio:result" },
    });
    const url = new URL(href, "https://hourglass.test");
    assert.equal(url.pathname, "/concierge");
    assert.equal(url.searchParams.get("tool"), "diamond-studio");
    assert.equal(url.searchParams.get("location"), "diamond_studio:result");
    assert.match(handoffSource, /diamond_studio:result/);
    assert.match(handoffSource, /tool: DIAMOND_STUDIO_HANDOFF_TOOL/);
    assert.doesNotMatch(handoffSource, /trackDiamondStudioEvent/);
    assert.match(handoffSource, /trackConsultationCtaClicked\(/);
    assert.match(handoffSource, /Begin the Conversation/);
    assert.doesNotMatch(
      handoffSource,
      /Book Now|Buy Now|Get a Quote|Schedule Your Free Consultation/,
    );
  });

  it("fires consultation_cta_clicked exactly once per click", () => {
    const events: Array<{ name: string; payload: Record<string, unknown> }> =
      [];
    const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { pathname: "/diamond-studio" },
        dataLayer: [] as unknown[],
        gtag: (
          command: string,
          name: string | Date,
          payload?: Record<string, unknown>,
        ) => {
          if (command === "event" && typeof name === "string") {
            events.push({ name, payload: payload ?? {} });
          }
        },
      },
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });

    try {
      process.env.NEXT_PUBLIC_GA_ID = "G-TESTONLY";
      resetClientAnalyticsForTests();
      armClientAnalytics();

      trackConsultationCtaClicked("diamond_studio:result");
      assert.equal(events.length, 1);
      assert.equal(events[0]?.name, CONSULTATION_CTA_EVENT);
      assert.equal(events[0]?.payload.location, "diamond_studio:result");
      assert.equal(events[0]?.payload.destination, "/concierge");
      assert.equal(events[0]?.payload.page_path, "/diamond-studio");
    } finally {
      resetClientAnalyticsForTests();
      if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
      else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
      Reflect.deleteProperty(globalThis, "window");
      Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });

  it("uses a tap-sized primary CTA rather than helper-link type", () => {
    assert.match(handoffSource, /<Button/);
    assert.doesNotMatch(handoffSource, /dts-stage-trust-link/);
    assert.doesNotMatch(handoffSource, /font-size:11px/);
    assert.match(handoffSource, /Need help translating this to your ring\?/);
    assert.match(handoffSource, /After you’ve compared/);
    assert.match(
      handoffSource,
      /Justin can help you compare apparent size, proportions, setting\s+style, and how the diamond will sit on the hand, including natural\s+and lab-grown options where relevant\./,
    );
    assert.doesNotMatch(handoffSource, /Graduate Gemologist/);
    assert.doesNotMatch(handoffSource, /After you have compared/);
  });
});
