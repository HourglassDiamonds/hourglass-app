import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { projectBook } from "@/lib/continuum/project-book/project";
import { presentProjectBook } from "@/lib/continuum/project-book/present";
import type { ProjectBookSourceRecord } from "@/lib/continuum/project-book/types";
import {
  applyReviewedAssociations,
  discoverProjectEvidence,
  evidenceReviewFromDiscovery,
  trustedEvidenceThreadIds,
} from "./discover";
import type { ProjectEvidenceTarget, ProjectEvidenceThread, ReviewedProjectEvidence } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "19fed961d1371aaf";
const STORED = "19fd370bc47c5e1f";

function project(overrides: Partial<ProjectEvidenceTarget> = {}): ProjectEvidenceTarget {
  return {
    projectId: PROJECT,
    label: "Dylon",
    cadJobNumber: "C025610",
    orderNumber: null,
    storedThreadId: null,
    matchJudgment: null,
    distrust: false,
    linkedPersonLabels: [],
    ...overrides,
  };
}

function thread(overrides: Partial<ProjectEvidenceThread> & Pick<ProjectEvidenceThread, "threadId">): ProjectEvidenceThread {
  return {
    subjects: [],
    attachmentFilenames: [],
    earliest: "2026-09-01T12:00:00.000Z",
    latest: "2026-09-21T18:00:00.000Z",
    ...overrides,
  };
}

function record(sourceRef: string): ProjectBookSourceRecord {
  return {
    sourceType: "gmail",
    sourceRef,
    timestamp: "2026-09-21T18:00:00.000Z",
    actor: "vendor_shop",
    direction: "inbound",
    semanticClass: "vendor_delivers_artifact",
    subject: "RE: HGD x Dylon D.-C025610",
    authorOwnedText: "CAD and STL are attached for review.",
    attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
    personLabel: "Dylon",
    projectId: PROJECT,
    association: "exact",
    plausibleProjectIds: [PROJECT],
    cadIds: ["C025610"],
    provenance: "indexed_gmail",
  };
}

describe("project evidence association", () => {
  it("treats an exact canonical stored thread as trusted", () => {
    const rows = discoverProjectEvidence({
      project: project({
        label: "J.Pennock",
        cadJobNumber: "C025519",
        storedThreadId: STORED,
        matchJudgment: "exact",
      }),
      catalog: [],
      threads: [thread({ threadId: STORED, subjects: ["Re: HGD- J.Pennock-C025519"] })],
      claimantProjectIds: [PROJECT],
    });
    assert.equal(rows[0]?.status, "trusted");
    assert.ok(rows[0]?.basis.flags.includes("exact_stored_gmail_thread"));
    assert.deepEqual(trustedEvidenceThreadIds(rows), [STORED]);
  });

  it("does not auto-trust an exact project number in a shop filename", () => {
    const rows = discoverProjectEvidence({
      project: project(),
      catalog: [{ projectId: PROJECT, label: "Dylon", cadJobNumber: "C025610", orderNumber: null }],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
        }),
      ],
      claimantProjectIds: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "candidate");
    assert.equal(trustedEvidenceThreadIds(rows).length, 0);
    assert.equal(evidenceReviewFromDiscovery(PROJECT, rows)?.possible.length, 1);
  });

  it("lets founder approval change a candidate into trusted chronology", () => {
    const discovered = discoverProjectEvidence({
      project: project(),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
        }),
      ],
    });
    const reviewed: ReviewedProjectEvidence[] = [
      {
        sourceIdentity: THREAD,
        status: "trusted",
        basis: discovered[0]!.basis,
      },
    ];
    const rows = applyReviewedAssociations(discovered, reviewed);
    assert.equal(rows[0]?.status, "trusted");
    assert.ok(rows[0]?.basis.flags.includes("founder_approval"));
    assert.deepEqual(trustedEvidenceThreadIds(rows), [THREAD]);
    const book = projectBook({
      projectId: PROJECT,
      projectLabel: "Dylon",
      nowIso: "2026-09-23T16:00:00.000Z",
      records: [record("trusted-thread")],
      evidenceReview: evidenceReviewFromDiscovery(PROJECT, rows),
    });
    assert.equal(book.historyState, "trusted");
    assert.equal(book.evidenceTimeline.length, 1);
    assert.equal(book.evidenceReview, null);
  });

  it("keeps an unresolved candidate out of chronology", () => {
    const rows = discoverProjectEvidence({
      project: project(),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["NL-H017-Dylon D-C025610.jpg"],
        }),
      ],
    });
    assert.equal(rows[0]?.status, "candidate");
    const book = projectBook({
      projectId: PROJECT,
      projectLabel: "Dylon",
      nowIso: "2026-09-23T16:00:00.000Z",
      records: [],
      evidenceReview: evidenceReviewFromDiscovery(PROJECT, rows),
    });
    assert.equal(book.historyState, "none");
    assert.equal(book.evidenceTimeline.length, 0);
    assert.equal(book.milestones.length, 0);
    assert.equal(book.evidenceReview?.possible.length, 1);
    const view = presentProjectBook(book);
    assert.match(view.evidenceReview?.possible?.summary ?? "", /may belong to this project/);
    assert.doesNotMatch(JSON.stringify(view.evidenceTimeline), /C025610/);
  });

  it("stops a rejected candidate from resurfacing", () => {
    const discovered = discoverProjectEvidence({
      project: project(),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
        }),
      ],
    });
    const rejected: ReviewedProjectEvidence[] = [
      { sourceIdentity: THREAD, status: "rejected", basis: discovered[0]!.basis },
    ];
    const rows = applyReviewedAssociations(discovered, rejected);
    assert.equal(rows[0]?.status, "rejected");
    assert.equal(evidenceReviewFromDiscovery(PROJECT, rows), null);
    assert.deepEqual(trustedEvidenceThreadIds(rows), []);
  });

  it("keeps an ambiguous candidate out of chronology", () => {
    const rows = discoverProjectEvidence({
      project: project({
        label: "Custom ring",
        cadJobNumber: "C023939",
        matchJudgment: "ambiguous",
        distrust: true,
        storedThreadId: "19eada43627c1933",
      }),
      catalog: [],
      threads: [
        thread({
          threadId: "19eada43627c1933",
          attachmentFilenames: ["NL-H017-Nick-C023939.jpg"],
          subjects: ["RE: HGD - Nick-C023939-RN07781"],
        }),
      ],
      claimantProjectIds: [PROJECT],
    });
    assert.equal(rows[0]?.status, "ambiguous");
    assert.ok(rows[0]?.basis.flags.includes("unresolved_identity"));
    const book = projectBook({
      projectId: PROJECT,
      projectLabel: "C023939",
      nowIso: "2026-09-23T16:00:00.000Z",
      associationTrusted: false,
      records: [record("nick")],
      evidenceReview: evidenceReviewFromDiscovery(PROJECT, rows),
    });
    assert.equal(book.historyState, "needs_review");
    assert.equal(book.evidenceTimeline.length, 0);
    assert.equal(book.evidenceReview?.ambiguous.length, 1);
    const view = JSON.stringify(presentProjectBook(book));
    assert.match(view, /Project evidence needs review/);
    assert.doesNotMatch(view, /Please review this CAD|19eada43627c1933/);
  });

  it("does not choose a winner when C025088 and C026350 conflict", () => {
    const rows = discoverProjectEvidence({
      project: project({
        label: "Jesse R.",
        cadJobNumber: "C025088",
        matchJudgment: "likely",
      }),
      catalog: [
        { projectId: PROJECT, label: "Jesse R.", cadJobNumber: "C025088", orderNumber: null },
        { projectId: OTHER, label: "Duane", cadJobNumber: "C026350", orderNumber: null },
      ],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["NL-H017-Jesse R. - C025088.jpg", "NL-H017-Duane-C026350.jpg"],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "ambiguous");
    assert.ok(rows[0]?.basis.flags.includes("conflicting_project_numbers"));
    assert.deepEqual(trustedEvidenceThreadIds(rows), []);
    assert.ok(rows[0]?.possibleMatches.some((match) => match.includes("C025088")));
    assert.ok(rows[0]?.possibleMatches.some((match) => match.includes("C026350")));
    assert.equal(rows.filter((row) => row.status === "trusted").length, 0);
  });

  it("keeps C023939 review-only", () => {
    const rows = discoverProjectEvidence({
      project: project({
        label: "Custom ring; final CAD after workshop receives stone",
        cadJobNumber: "C023939",
        orderNumber: "RN07781",
        storedThreadId: "19eada43627c1933",
        matchJudgment: "ambiguous",
        distrust: true,
      }),
      catalog: [
        {
          projectId: PROJECT,
          label: "Custom ring; final CAD after workshop receives stone",
          cadJobNumber: "C023939",
          orderNumber: "RN07781",
        },
      ],
      threads: [
        thread({
          threadId: "19e46b6445bb4c38",
          attachmentFilenames: ["NL-H017-Nick-C023939_Mod2.jpg"],
        }),
      ],
      claimantProjectIds: [PROJECT],
    });
    assert.ok(rows.every((row) => row.status !== "trusted"));
    assert.ok(rows.some((row) => row.status === "ambiguous"));
    assert.equal(trustedEvidenceThreadIds(rows).length, 0);
  });

  it("does not attach a whole thread when another message names a different project", () => {
    const rows = discoverProjectEvidence({
      project: project(),
      catalog: [
        { projectId: OTHER, label: "Duane", cadJobNumber: "C026350", orderNumber: null },
      ],
      threads: [
        thread({
          threadId: THREAD,
          subjects: ["RE: HGD x Duane-C026350"],
          attachmentFilenames: ["NL-H017-Dylon D-C025610.stl"],
        }),
      ],
    });
    assert.equal(rows[0]?.status, "ambiguous");
    assert.deepEqual(trustedEvidenceThreadIds(rows), []);
  });

  it("can candidate a linked person together with the project's number", () => {
    const rows = discoverProjectEvidence({
      project: project({ linkedPersonLabels: ["Dylon D"] }),
      catalog: [],
      threads: [thread({ threadId: THREAD, subjects: ["HGD x Dylon D.-C025610"] })],
    });
    assert.equal(rows[0]?.status, "candidate");
    assert.ok(rows[0]?.basis.flags.includes("known_person_commercial"));
    assert.equal(trustedEvidenceThreadIds(rows).length, 0);
  });

  it("rejects a subject-only project number", () => {
    const rows = discoverProjectEvidence({
      project: project({ label: "F. Grant", cadJobNumber: "C025885" }),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          subjects: ["RE: HGD x F.Grant-C025885-SP13477"],
        }),
      ],
    });
    assert.deepEqual(rows, []);
  });

  it("rejects a display-name-only match", () => {
    const rows = discoverProjectEvidence({
      project: project({ linkedPersonLabels: ["Dylon"] }),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          subjects: ["Hello Dylon"],
          attachmentFilenames: ["Dylon-portrait.jpg"],
        }),
      ],
    });
    assert.deepEqual(rows, []);
  });

  it("lets a meaningful CAD filename create a candidate and not trusted history", () => {
    const rows = discoverProjectEvidence({
      project: project(),
      catalog: [],
      threads: [
        thread({
          threadId: THREAD,
          attachmentFilenames: ["image001.jpg", "NL-H017-Dylon D-C025610-Mod4.stl"],
        }),
      ],
    });
    assert.equal(rows[0]?.status, "candidate");
    assert.match(rows[0]?.reason ?? "", /C025610/);
    assert.ok(rows[0]?.attachmentNames.includes("NL-H017-Dylon D-C025610-Mod4.stl"));
    assert.equal(rows[0]?.attachmentNames.includes("image001.jpg"), false);
    const book = projectBook({
      projectId: PROJECT,
      projectLabel: "Dylon",
      records: [],
      nowIso: "2026-09-23T16:00:00.000Z",
      evidenceReview: evidenceReviewFromDiscovery(PROJECT, rows),
    });
    assert.notEqual(book.historyState, "trusted");
    assert.equal(book.evidenceTimeline.length, 0);
  });

  it("does not mint a person or project, or mutate Today, work loops, Gmail, Calendar, or SMS", () => {
    const discoverSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "discover.ts"), "utf8");
    const writeSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "write.ts"), "utf8");
    const loadSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "load.ts"), "utf8");
    const action = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/project-evidence-actions.ts"),
      "utf8",
    );
    const combined = `${discoverSource}\n${writeSource}\n${loadSource}\n${action}`;
    assert.doesNotMatch(combined, /insertEntity|createPerson|createFounderProject|continuum_entities/);
    assert.doesNotMatch(combined, /composeTodayDocket|loadTodaySurface|reduceWorkLoop|createProjectJob/);
    assert.doesNotMatch(combined, /gmail\.googleapis|users\.messages|refresh_token/i);
    assert.doesNotMatch(combined, /from ["']@\/lib\/continuum\/calendar|from ["'].*sms|twilio/i);
    assert.doesNotMatch(writeSource, /from\("continuum_project_profiles"\)\s*\.insert|from\("continuum_person_profiles"\)\s*\.insert/);
    assert.match(writeSource, /founder_approval|founder_rejection/);
    assert.doesNotMatch(writeSource, /body|phone|refresh_token|attachment bytes/i);
  });

  it("classifies a bounded thread set quickly and without a model", () => {
    const threads = Array.from({ length: 32 }, (_, index) =>
      thread({
        threadId: `19fed961d1371a${index.toString(16).padStart(2, "0")}`,
        attachmentFilenames: index % 2 === 0 ? [`NL-H017-Dylon D-C025610-${index}.stl`] : ["notes.pdf"],
        subjects: ["checking in"],
      }),
    );
    const started = performance.now();
    const rows = discoverProjectEvidence({
      project: project(),
      catalog: [],
      threads,
    });
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 50, `discovery took ${elapsed}ms`);
    assert.ok(rows.every((row) => row.status !== "trusted"));
    assert.doesNotMatch(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "discover.ts"), "utf8"),
      /openai|generateText|concierge-sol/i,
    );
  });
});
