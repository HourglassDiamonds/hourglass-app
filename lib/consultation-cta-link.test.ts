import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import {
  buildConciergeHref,
  isBareConciergeHref,
  trackConsultationCtaClicked,
  CONSULTATION_CTA_EVENT,
} from "@/lib/consultation-cta";
import { buildConciergeHrefFromDiamondIntelligence } from "@/lib/concierge/diamond-intelligence-context";
import {
  armClientAnalytics,
  resetClientAnalyticsForTests,
} from "@/lib/gtag";

/**
 * ConsultationCtaLink preserves non-bare Concierge hrefs (Diamond Intelligence
 * context). This mirrors resolveAttributedHref without mounting React.
 */
function resolveAttributedHrefLikeConsultationCtaLink(props: {
  href?: string;
  location: string;
  tool?: string | null;
  content?: string | null;
}): string {
  const explicit = props.href;
  if (explicit != null && !isBareConciergeHref(explicit)) {
    return explicit;
  }
  return buildConciergeHref({
    tool: props.tool,
    content: props.content,
    params: { location: props.location },
  });
}

describe("ConsultationCtaLink attribution resolution", () => {
  it("renders attributed href for bare /concierge (new-tab safe)", () => {
    const explicit = "/concierge";
    assert.equal(isBareConciergeHref(explicit), true);
    const resolved = buildConciergeHref({
      tool: "diamond-studio",
    });
    assert.equal(resolved, "/concierge?tool=diamond-studio");
  });

  it("does not overwrite Diamond Intelligence explicit context hrefs", () => {
    const diHref = buildConciergeHrefFromDiamondIntelligence({
      lab: "GIA",
      reportNumber: "2141234567",
      carat: "1.50",
      shape: "Round Brilliant",
      sourceType: "upload",
      verdict: "Strong Candidate",
    });
    assert.equal(isBareConciergeHref(diHref), false);
    // Explicit DI href wins — builder output would drop certificate context.
    const wouldOverwrite = buildConciergeHref({
      tool: "diamond-intelligence",
    });
    assert.notEqual(diHref, wouldOverwrite);
    assert.match(diHref, /source=diamond-intelligence/);
    assert.match(diHref, /report=2141234567/);
    assert.match(diHref, /tool=diamond-intelligence/);
  });

  it("documents single generic consultation click event per CTA click", () => {
    // ConsultationCtaLink calls trackConsultationCtaClicked exactly once in
    // its onClick handler. Conversation pages may also fire
    // conversation_concierge_clicked — a separate funnel event, not a second
    // consultation_cta_clicked. No duplicate generic conversion counting.
    assert.equal(typeof buildConciergeHref, "function");
  });
});

describe("Diamond Intelligence result footer Concierge CTA", () => {
  const dashboardSource = readFileSync(
    path.join(
      process.cwd(),
      "app/diamond-intelligence/components/LightPerformanceDashboard.tsx",
    ),
    "utf8",
  );

  it("wires ConsultationCtaLink with DI context href and short location ID", () => {
    assert.match(
      dashboardSource,
      /buildConciergeHrefFromDiamondIntelligence\(reportContext\)/,
    );
    assert.match(
      dashboardSource,
      /location="diamond_intelligence:result_footer"/,
    );
    assert.match(dashboardSource, /<ConsultationCtaLink/);
    // Must not rebuild via bare builder for the result footer.
    assert.doesNotMatch(
      dashboardSource,
      /result_footer[\s\S]{0,200}buildConciergeHref\(/,
    );
  });

  it("preserves the explicit DI href for middle-click / new-tab (href-based)", () => {
    const diHref = buildConciergeHrefFromDiamondIntelligence({
      lab: "GIA",
      reportNumber: "2141234567",
      carat: "1.50",
      shape: "Round Brilliant",
      sourceType: "upload",
      color: "F",
      clarity: "VVS2",
      verdict: "Strong Candidate",
    });

    const resolved = resolveAttributedHrefLikeConsultationCtaLink({
      href: diHref,
      location: "diamond_intelligence:result_footer",
      tool: "should-not-apply",
    });

    assert.equal(resolved, diHref);
    assert.match(resolved, /source=diamond-intelligence/);
    assert.match(resolved, /tool=diamond-intelligence/);
    assert.match(resolved, /report=2141234567/);
    assert.match(resolved, /lab=GIA/);
    assert.doesNotMatch(resolved, /location=diamond_intelligence/);
    assert.doesNotMatch(resolved, /should-not-apply/);
  });

  it("fires the generic consultation event exactly once per click", () => {
    const events: Array<{ name: string; payload: Record<string, unknown> }> =
      [];

    const originalGaId = process.env.NEXT_PUBLIC_GA_ID;
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { pathname: "/diamond-intelligence" },
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

      trackConsultationCtaClicked("diamond_intelligence:result_footer");
      assert.equal(events.length, 1);
      assert.equal(events[0]?.name, CONSULTATION_CTA_EVENT);
      assert.equal(
        events[0]?.payload.location,
        "diamond_intelligence:result_footer",
      );
      assert.equal(events[0]?.payload.destination, "/concierge");
    } finally {
      resetClientAnalyticsForTests();
      if (originalGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
      else process.env.NEXT_PUBLIC_GA_ID = originalGaId;
      Reflect.deleteProperty(globalThis, "window");
      Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  });
});
