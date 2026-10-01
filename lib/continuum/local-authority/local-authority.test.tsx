import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalAuthorityWorkspaceView } from "@/app/executive-dashboard/concierge/components/local-authority-workspace";
import {
  composeLocalAuthorityWorkspace,
} from "./compose";
import { defaultAuthorityRegister } from "@/lib/intelligence/review-velocity/corroboration-register";
import { TRACKED_BUSINESSES, type LocalAuthorityInput } from "./types";

function input(completeCoverage = false): LocalAuthorityInput {
  return {
    places: TRACKED_BUSINESSES.map((displayName, index) => ({
      id: `place-${index}`,
      displayName,
      role: index === 0 ? "self" as const : "competitor" as const,
      googlePlaceId: `google-place-${index}`,
      active: true,
    })),
    snapshots: TRACKED_BUSINESSES.flatMap((_, index) =>
      (completeCoverage
        ? [["2026-03-01", 100 + index], ["2026-07-01", 103 + index], ["2026-10-01", 106 + index]]
        : [["2026-09-01", 100 + index], ["2026-10-01", 101 + index]]
      ).map(([capturedOn, reviewCount]) => ({
        placeId: `place-${index}`,
        capturedOn: String(capturedOn),
        reviewCount: Number(reviewCount),
        rating: 4.8,
        source: "places-details" as const,
        sourceRef: null,
      }))),
    ownReviews: ["2026-02-01T12:00:00Z", "2026-09-15T12:00:00Z"].map((publishedAt, index) => ({
      reviewName: `reviews/${index}`,
      placeId: "place-0",
      publishedAt,
      starRating: 5,
      hasOwnerReply: false,
      replyPublishedAt: null,
    })),
    corroboration: [],
    searchSignals: [],
    loadedAt: "2026-10-01T12:00:00Z",
  };
}

describe("Continuum Local Authority", () => {
  it("renders all five seeded tracked businesses", () => {
    const html = renderToStaticMarkup(
      <LocalAuthorityWorkspaceView workspace={composeLocalAuthorityWorkspace(input())} selectedWindow={6} />,
    );
    for (const name of TRACKED_BUSINESSES) assert.match(html, new RegExp(name));
  });

  it("keeps unavailable windows unavailable and hides tracked-growth share", () => {
    const workspace = composeLocalAuthorityWorkspace(input());
    assert.equal(workspace.businesses[1].windows[3].reviewsAdded, null);
    assert.equal(workspace.businesses[1].windows[12].method, "unavailable");
    assert.equal(workspace.shareOfTrackedReviewGrowth, null);
    const html = renderToStaticMarkup(
      <LocalAuthorityWorkspaceView workspace={workspace} selectedWindow={12} />,
    );
    assert.doesNotMatch(html, /Share of tracked review growth/);
    assert.match(html, /Insufficient 12m coverage/);
  });

  it("never labels a competitor snapshot as its last review", () => {
    const html = renderToStaticMarkup(
      <LocalAuthorityWorkspaceView workspace={composeLocalAuthorityWorkspace(input())} selectedWindow={3} />,
    );
    assert.match(html, /Evidence through Oct 1, 2026/);
    assert.doesNotMatch(html, /Donald Haack Diamonds[\s\S]{0,800}Latest exact review/);
  });

  it("defaults no corroboration source to live and deduplicates actions", () => {
    assert.equal(defaultAuthorityRegister().some((row) => row.status === "live"), false);
    const duplicated = input();
    duplicated.corroboration = [
      ...defaultAuthorityRegister(),
      ...defaultAuthorityRegister(),
    ];
    const workspace = composeLocalAuthorityWorkspace(duplicated);
    assert.equal(workspace.actions.length, new Set(workspace.actions.map((row) => row.id)).size);
    assert.equal(workspace.actions.every((row) => row.status === "proposed"), true);
  });

  it("hands proposals to canonical Open Jobs without creating a second task store", () => {
    const component = readFileSync(
      join(process.cwd(), "app/executive-dashboard/concierge/components/local-authority-workspace.tsx"),
      "utf8",
    );
    const composer = readFileSync(join(process.cwd(), "lib/continuum/local-authority/compose.ts"), "utf8");
    assert.match(component, /\/executive-dashboard\/concierge\/action\/new/);
    assert.doesNotMatch(composer, /createProjectJob|continuum_project_jobs|\.from\(/);
  });

  it("renders provenance, method labels, and honest empty states", () => {
    const empty = composeLocalAuthorityWorkspace({
      places: [],
      snapshots: [],
      ownReviews: [],
      corroboration: [],
      searchSignals: [],
      loadedAt: "2026-10-01T12:00:00Z",
    });
    const html = renderToStaticMarkup(
      <LocalAuthorityWorkspaceView workspace={empty} selectedWindow={6} />,
    );
    assert.match(html, /Static fallback/);
    assert.match(html, /No imported Local Falcon competitor evidence yet/);
    assert.match(html, /Review tracking has not started/);
    assert.match(html, /Unavailable/);
  });

  it("keeps review labels distinct from commercial outcomes", () => {
    const html = renderToStaticMarkup(
      <LocalAuthorityWorkspaceView workspace={composeLocalAuthorityWorkspace(input(true))} selectedWindow={6} />,
    );
    const tableHead = html.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? "";
    assert.doesNotMatch(tableHead, /sales|revenue|market share/i);
  });

  it("keeps the executive dashboard summary lighter and links to Continuum", () => {
    const dashboard = readFileSync(join(process.cwd(), "app/executive-dashboard/dashboard-view.tsx"), "utf8");
    const localSection = dashboard.slice(dashboard.indexOf('eyebrow="Local"'), dashboard.indexOf('eyebrow="Paths"'));
    assert.match(localSection, /ReviewAuthoritySummary/);
    assert.doesNotMatch(localSection, /ReviewAuthorityTable/);
    assert.match(localSection, /executive-dashboard\/concierge\/local-authority/);
  });

  it("keeps the route behind the Continuum founder session", () => {
    const layout = readFileSync(join(process.cwd(), "app/executive-dashboard/concierge/layout.tsx"), "utf8");
    const loader = readFileSync(join(process.cwd(), "lib/continuum/local-authority/load.ts"), "utf8");
    assert.match(layout, /requireInternalClientMemorySession/);
    assert.match(loader, /requireInternalClientMemorySession/);
    assert.doesNotMatch(loader, /NEXT_PUBLIC_.*SUPABASE|service_role/i);
  });
});
