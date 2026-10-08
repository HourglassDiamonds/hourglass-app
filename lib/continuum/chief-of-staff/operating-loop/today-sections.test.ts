import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { composeTodaySections } from "./docket";
import type { CosDocketItemView, CosWatchingItem } from "./types";

function active(id: string, ballHolder: "founder" | "client" | "vendor_shop", lifecycle: string | null): CosDocketItemView {
  return {
    id,
    lane: "live_work",
    origin: "open_job",
    subject: id,
    headline: `Handle ${id}`,
    context: null,
    job: { id: `job-${id}`, sourceType: "open_job", action: id, clientLabel: null, projectTitle: id, projectId: `project-${id}`, ownership: "Founder", timing: "Now", why: "Current", accordionHref: null, jobHref: null, completable: true, writer: "open_job.resolve", mutationId: `mutation-${id}`, editHref: null },
    brief: null,
    decision: null,
    anomaly: null,
    briefingPacket: {
      itemId: id, displayName: id, entityType: "client", briefingKind: "generic", projectName: id,
      projectId: `project-${id}`, personId: null, organizationLabel: null, vendorContactName: null,
      identifiers: [], lifecycle, latestMeaningfulExternalEvent: null, latestMeaningfulFounderAction: null,
      ballHolder, unresolvedFounderObligation: ballHolder === "founder" ? `Handle ${id}` : null,
      externalCommitment: null, nextExpectedEvent: null, candidateNextAction: null, uncertainty: [],
      mustNotState: [], sourceRefs: [], authoritative: true,
    },
  };
}

describe("Today operating sections", () => {
  it("keeps founder work first and separates client, CAD, production, and repair work", () => {
    const watching: CosWatchingItem[] = [{
      id: "repair", title: "Repair — Smith", detail: "Bench work active", projectId: "project-repair",
      briefingPacket: { ...active("repair", "vendor_shop", "repair").briefingPacket!, itemId: "repair", displayName: "Smith" },
    }];
    const sections = composeTodaySections({
      active: [
        active("Founder obligation", "founder", "design"),
        active("Client approval", "client", "client_approval"),
        active("CAD update", "vendor_shop", "cad"),
        active("Dylan", "vendor_shop", "in_production"),
      ],
      watching,
    });
    assert.deepEqual(sections.map((section) => section.id), ["founder", "ready", "waiting_client", "cad_design", "production", "repairs", "watching"]);
    assert.equal(sections.find((section) => section.id === "founder")?.items[0]?.id, "Founder obligation");
    assert.equal(sections.find((section) => section.id === "waiting_client")?.items[0]?.id, "Client approval");
    assert.equal(sections.find((section) => section.id === "cad_design")?.items[0]?.id, "CAD update");
    assert.equal(sections.find((section) => section.id === "production")?.items[0]?.id, "Dylan");
    assert.equal(sections.find((section) => section.id === "repairs")?.items[0]?.id, "repair");
  });

  it("uses the final production state before stale CAD history when assigning a section", () => {
    const timJenn = active("Tim Jenn / C025964", "vendor_shop", "cad");
    timJenn.headline = "Old CAD history; production completion is now external.";
    timJenn.briefing = {
      displayName: "Tim Jenn",
      projectName: "C025964",
      stateChip: "IN PRODUCTION",
      stand: "The order is in production.",
      headline: "In production",
      nextLabel: "Waiting on",
      nextBody: "production completion",
      nextKind: "waiting_on",
      source: "deterministic",
    };
    timJenn.briefingPacket = {
      ...timJenn.briefingPacket!,
      projection: {
        workstreamId: "project-tim-jenn",
        stage: "in_production",
        dependency: "production completion",
        ballHolder: "vendor_shop",
        commitment: null,
        activeObligations: [],
        historicalObligations: [],
        controllingSourceRefs: ["confirmation:SP13591"],
        provenance: [],
        asOf: "2026-10-07T16:00:00.000Z",
      },
    };

    const first = composeTodaySections({ active: [], watching: [{
      id: timJenn.id,
      title: timJenn.subject,
      detail: timJenn.headline,
      projectId: timJenn.briefingPacket.projectId,
      briefing: timJenn.briefing,
      briefingPacket: timJenn.briefingPacket,
    }] });
    const second = composeTodaySections({ active: [], watching: [{
      id: timJenn.id,
      title: timJenn.subject,
      detail: timJenn.headline,
      projectId: timJenn.briefingPacket.projectId,
      briefing: timJenn.briefing,
      briefingPacket: timJenn.briefingPacket,
    }] });

    assert.equal(first.find((section) => section.id === "production")?.items[0]?.id, timJenn.id);
    assert.equal(first.find((section) => section.id === "cad_design")?.items.length, 0);
    assert.deepEqual(first, second);
  });

  it("uses the current founder obligation text for section rows", () => {
    const abbey = active("Abbey / C026137", "founder", "cad");
    abbey.headline = "Send Abbey the revised rendering";
    abbey.briefing = {
      displayName: "Abbey",
      projectName: "C026137",
      stateChip: "YOUR MOVE",
      stand: "The updated CAD is in.",
      headline: "CAD is in.",
      nextLabel: "Best next step",
      nextBody: "CAD review",
      nextKind: "best_next_step",
      source: "deterministic",
    };
    const sections = composeTodaySections({ active: [abbey], watching: [] });
    assert.equal(sections.find((section) => section.id === "founder")?.items[0]?.summary, "CAD review");
  });

  it("keeps row-scoped optimistic moves reversible until the canonical write succeeds", () => {
    const source = readFileSync(
      "app/executive-dashboard/concierge/components/today-operating-sections.tsx",
      "utf8",
    );
    assert.match(source, /setSections\(\s*applyOptimistic\(/);
    assert.match(source, /!result\.writesCanonical && move/);
    assert.match(source, /setSections\(before\.map/);
    assert.match(source, /setHiddenIntakes\(new Set\(beforeHidden\)\)/);
    assert.match(source, /data-tell-sterling=""/);
    assert.doesNotMatch(source, /window\.location|location\.reload/);
  });
});
