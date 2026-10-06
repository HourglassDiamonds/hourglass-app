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
      briefingPacket: { ...active("repair", "vendor_shop", "bench").briefingPacket!, itemId: "repair", displayName: "Smith" },
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
