import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
  ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
  ALEA_CHEDEKAL_FIXTURE_PROJECT_ID,
  ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
  ALEA_CHEDEKAL_PROJECT_A_CAD,
  ALEA_CHEDEKAL_PROJECT_A_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_CAD,
  ALEA_CHEDEKAL_PROJECT_B_ORDER,
  ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
  aleaChedekalProjectBProtectedThread,
  aleaChedekalReconstructionInput,
} from "./alea-chedekal-fixture";
import {
  CONTAINMENT_MUTATION_BOUNDARY,
  PERSON_LEVEL_MEMORY_KINDS,
  PROJECT_LEVEL_MEMORY_KINDS,
  RELATED_THREAD_DISCOVERY_HANDOFF,
  containIsolatedReconstructedBook,
  mayStoreOnPerson,
  memoryPlaneForKind,
  routeProjectEvidence,
  routeRelatedThreadCandidates,
  type ExistingProjectBook,
  type ProjectEvidenceCandidate,
} from "./project-book-containment";
import { reconstructProjectBook } from "./project-reconstruction";

const DIR = dirname(fileURLToPath(import.meta.url));

const PERSON = {
  personId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  displayName: "Ada Client",
} as const;

const PROJECT_A_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_B_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function book(
  extra: Pick<ExistingProjectBook, "projectId" | "title"> &
    Partial<ExistingProjectBook>,
): ExistingProjectBook {
  return {
    personId: PERSON.personId,
    lifecycle: "historical_closed",
    items: [],
    cadJobNumbers: [],
    orderNumbers: [],
    gmailThreadIds: [],
    artifactRefs: [],
    vendors: [],
    subjectTerms: [],
    dateRange: null,
    ...extra,
  };
}

function evidence(
  extra: Pick<ProjectEvidenceCandidate, "evidenceId" | "text"> &
    Partial<ProjectEvidenceCandidate>,
): ProjectEvidenceCandidate {
  return {
    kind: "email",
    personId: PERSON.personId,
    subject: extra.subject ?? extra.text.slice(0, 40),
    sentAt: "2026-01-01T12:00:00.000Z",
    threadId: extra.threadId ?? `thread-${extra.evidenceId}`,
    messageId: extra.messageId ?? `msg-${extra.evidenceId}`,
    vendorMentions: [],
    artifact: null,
    ...extra,
  };
}

const COLLISION_BOOKS: ExistingProjectBook[] = [
  book({
    projectId: PROJECT_A_ID,
    title: "Engagement ring 2023",
    items: [{ itemId: "item-ring", itemType: "ring" }],
    cadJobNumbers: ["CAD-1001"],
    orderNumbers: ["ORD-1001"],
    gmailThreadIds: ["thread-project-a"],
    artifactRefs: ["att-ring-cad", "cad-1001-render.pdf"],
    vendors: ["Vendor North"],
    subjectTerms: ["engagement", "ring"],
    dateRange: { start: "2023-01-01T00:00:00.000Z", end: "2023-12-31T23:59:59.000Z" },
  }),
  book({
    projectId: PROJECT_B_ID,
    title: "Anniversary bracelet 2026",
    items: [{ itemId: "item-bracelet", itemType: "bracelet" }],
    cadJobNumbers: ["CAD-2204"],
    orderNumbers: ["ORD-2204"],
    gmailThreadIds: ["thread-project-b"],
    artifactRefs: ["att-bracelet-cad", "cad-2204-render.pdf"],
    vendors: ["Vendor North"],
    subjectTerms: ["anniversary", "bracelet"],
    dateRange: { start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T23:59:59.000Z" },
  }),
];

function collide(rows: ProjectEvidenceCandidate[]) {
  return routeProjectEvidence({
    person: PERSON,
    projectBooks: COLLISION_BOOKS,
    evidence: rows,
  });
}

function aleaBooks(): ExistingProjectBook[] {
  return [
    book({
      personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
      projectId: ALEA_CHEDEKAL_FIXTURE_PROJECT_ID,
      title: "Loose stones and bracelet concept",
      items: [
        { itemId: "item-loose_stones", itemType: "loose_stones" },
        { itemId: "item-bracelet", itemType: "bracelet" },
      ],
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_A_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_A_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_FIXTURE_THREAD_ID],
      artifactRefs: ["att-stones-invoice", "att-cad-presentation"],
      vendors: ["Vendor North"],
      subjectTerms: ["bracelet", "marquise", "champagne"],
      dateRange: {
        start: "2024-03-01T00:00:00.000Z",
        end: "2024-04-30T23:59:59.000Z",
      },
    }),
    book({
      personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
      projectId: ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
      title: "Anniversary necklace",
      items: [{ itemId: "item-necklace", itemType: "necklace" }],
      cadJobNumbers: [ALEA_CHEDEKAL_PROJECT_B_CAD],
      orderNumbers: [ALEA_CHEDEKAL_PROJECT_B_ORDER],
      gmailThreadIds: [ALEA_CHEDEKAL_PROJECT_B_THREAD_ID],
      artifactRefs: ["att-necklace-cad"],
      vendors: ["Vendor North"],
      subjectTerms: ["anniversary", "necklace"],
      dateRange: {
        start: "2026-05-01T00:00:00.000Z",
        end: "2026-05-31T23:59:59.000Z",
      },
    }),
  ];
}

describe("person vs project ownership boundary", () => {
  it("keeps relationship facts on Person and project evidence on Project Books", () => {
    for (const kind of PERSON_LEVEL_MEMORY_KINDS) {
      assert.equal(memoryPlaneForKind(kind), "person");
      assert.equal(mayStoreOnPerson(kind), true);
    }
    for (const kind of PROJECT_LEVEL_MEMORY_KINDS) {
      assert.equal(memoryPlaneForKind(kind), "project");
      assert.equal(mayStoreOnPerson(kind), false);
    }
    const result = collide([]);
    assert.equal(result.personList.relationshipMemory.projectEvidenceInlined, false);
    assert.deepEqual(result.personList.relationshipMemory.linkedProjectBookIds, [
      PROJECT_A_ID,
      PROJECT_B_ID,
    ]);
    assert.equal(result.personList.inlinedHistoricalDump, false);
    assert.equal(result.personList.projectBooks.length, 2);
  });
});

describe("one Person → many independent Project Books", () => {
  it("isolates evidence by project UUID for the same Person", () => {
    const result = collide([
      evidence({
        evidenceId: "cad-b",
        text: "Please see CAD-2204 for the bracelet.",
        sentAt: "2026-06-02T12:00:00.000Z",
      }),
      evidence({
        evidenceId: "cad-a",
        text: "CAD-1001 engagement ring update.",
        sentAt: "2023-04-02T12:00:00.000Z",
      }),
    ]);
    assert.equal(result.projectBooks.length, 2);
    const cadB = result.attributions.find((row) => row.evidenceId === "cad-b");
    const cadA = result.attributions.find((row) => row.evidenceId === "cad-a");
    assert.equal(cadB?.resolution, "exact_project");
    assert.equal(cadB?.attachedProjectId, PROJECT_B_ID);
    assert.equal(cadA?.resolution, "exact_project");
    assert.equal(cadA?.attachedProjectId, PROJECT_A_ID);
    const viewA = result.views.find((row) => row.projectId === PROJECT_A_ID);
    const viewB = result.views.find((row) => row.projectId === PROJECT_B_ID);
    assert.equal(viewA?.sourceEvidence.some((row) => row.evidenceId === "cad-b"), false);
    assert.equal(viewB?.sourceEvidence.some((row) => row.evidenceId === "cad-a"), false);
  });

  it("treats same Person alone as insufficient for project attribution", () => {
    const result = collide([
      evidence({
        evidenceId: "person-only",
        subject: "Hello",
        text: "Hi, just checking in",
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "person_related_unassigned");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(
      result.attributions[0]?.communicationRouting,
      "unassigned_needs_project_routing",
    );
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "person_identity_only"),
      true,
    );
    assert.equal(
      result.views.every((view) => view.correspondence.length === 0),
      true,
    );
  });

  it("treats same vendor alone as insufficient", () => {
    const result = collide([
      evidence({
        evidenceId: "vendor-only",
        subject: "Workshop note",
        text: "Checking in from the workshop.",
        vendorMentions: ["Vendor North"],
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "person_related_unassigned");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "vendor_only"),
      true,
    );
    assert.equal(result.possibleNewProjects.length, 0);
  });
});

describe("explainable project evidence attribution", () => {
  it("routes exact CAD to the owning project only", () => {
    const result = collide([
      evidence({
        evidenceId: "cad-2204",
        text: "CAD-2204 is ready.",
      }),
    ]);
    const row = result.attributions[0];
    assert.ok(row);
    assert.equal(row.resolution, "exact_project");
    assert.equal(row.attachedProjectId, PROJECT_B_ID);
    assert.equal(row.candidateProjectId, PROJECT_B_ID);
    assert.equal(row.requiresFounderReview, false);
    assert.equal(row.duplicatedAcrossProjects, false);
    assert.equal(
      row.reasons.some(
        (reason) =>
          reason.kind === "exact_cad_job_identifier" && reason.value === "CAD-2204",
      ),
      true,
    );
    assert.equal(row.candidates[0]?.candidateProjectId, PROJECT_B_ID);
    assert.equal(typeof row.score, "number");
  });

  it("routes exact order identifiers to the owning project only", () => {
    const result = collide([
      evidence({
        evidenceId: "order-a",
        text: "Order #ORD-1001 shipped.",
      }),
    ]);
    assert.equal(result.attributions[0]?.attachedProjectId, PROJECT_A_ID);
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "exact_order_identifier"),
      true,
    );
    assert.equal(
      result.views
        .find((view) => view.projectId === PROJECT_B_ID)
        ?.sourceEvidence.some((row) => row.evidenceId === "order-a"),
      false,
    );
  });

  it("keeps ambiguous and generic evidence unassigned", () => {
    const result = collide([
      evidence({
        evidenceId: "generic-update",
        subject: "Hi",
        text: "Hi, attached is the update",
      }),
      evidence({
        evidenceId: "span",
        text: "Please compare CAD-1001 and CAD-2204.",
      }),
    ]);
    const generic = result.attributions.find((row) => row.evidenceId === "generic-update");
    const span = result.attributions.find((row) => row.evidenceId === "span");
    assert.equal(generic?.resolution, "person_related_unassigned");
    assert.equal(generic?.attachedProjectId, null);
    assert.equal(generic?.requiresFounderReview, true);
    assert.equal(span?.resolution, "ambiguous_between_projects");
    assert.equal(span?.attachedProjectId, null);
    assert.equal(span?.duplicatedAcrossProjects, false);
    assert.equal(span?.requiresFounderReview, true);
    assert.deepEqual([...span!.spanningProjectIds].sort(), [PROJECT_A_ID, PROJECT_B_ID].sort());
    assert.equal(
      result.views.every((view) =>
        view.correspondence.every(
          (row) => row.evidenceId !== "generic-update" && row.evidenceId !== "span",
        ),
      ),
      true,
    );
  });

  it("does not copy person-related generic messages into every Project Book", () => {
    const result = collide([
      evidence({
        evidenceId: "hello",
        subject: "Hello",
        text: "Hello thank you",
      }),
    ]);
    assert.equal(result.attributions[0]?.communicationRouting, "unassigned_needs_project_routing");
    for (const view of result.views) {
      assert.equal(view.correspondence.length, 0);
      assert.equal(view.sourceEvidence.length, 0);
    }
  });
});

describe("artifact and communication ownership", () => {
  it("ties artifact metadata to the exact project and never fetches bytes", () => {
    const result = collide([
      evidence({
        evidenceId: "artifact-b",
        kind: "artifact_metadata",
        text: "CAD-2204 render attached.",
        artifact: {
          artifactId: "att-bracelet-cad",
          itemId: "item-bracelet",
          sourceMessageId: "msg-artifact-b",
          sourceThreadId: "thread-project-b",
          filename: "cad-2204-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ]);
    const artifact = result.artifacts[0];
    assert.ok(artifact);
    assert.equal(artifact.projectId, PROJECT_B_ID);
    assert.equal(artifact.itemId, "item-bracelet");
    assert.equal(artifact.bytesFetched, false);
    assert.equal(artifact.reviewState, "assigned");
    const viewA = result.views.find((row) => row.projectId === PROJECT_A_ID);
    const viewB = result.views.find((row) => row.projectId === PROJECT_B_ID);
    assert.equal(viewA?.artifacts.some((row) => row.artifactId === "att-bracelet-cad"), false);
    assert.equal(viewB?.artifacts.some((row) => row.artifactId === "att-bracelet-cad"), true);
    assert.equal(
      viewA?.artifacts.some((row) => row.filename === "cad-2204-render.pdf"),
      false,
    );
  });

  it("associates a thread with one project, not every project for the Person", () => {
    const result = collide([
      evidence({
        evidenceId: "thread-b",
        text: "Thread already anchored.",
        threadId: "thread-project-b",
      }),
    ]);
    assert.equal(result.attributions[0]?.attachedProjectId, PROJECT_B_ID);
    assert.equal(result.attributions[0]?.communicationRouting, "exact");
    assert.equal(
      result.views.find((row) => row.projectId === PROJECT_A_ID)?.correspondence.length,
      0,
    );
    assert.equal(
      result.views.find((row) => row.projectId === PROJECT_B_ID)?.correspondence.length,
      1,
    );
  });
});

describe("possible new project and historical safety", () => {
  it("emits possible_new_project without creating a Project row", () => {
    const before = COLLISION_BOOKS.map((row) => row.projectId);
    const result = collide([
      evidence({
        evidenceId: "new-cad",
        text: "New engagement: CAD-7777 pendant concept.",
        sentAt: "2027-02-01T12:00:00.000Z",
      }),
    ]);
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(result.possibleNewProjects.length, 1);
    assert.equal(result.possibleNewProjects[0]?.kind, "possible_new_project");
    assert.equal(result.possibleNewProjects[0]?.automaticCreate, false);
    assert.equal(result.possibleNewProjects[0]?.requiresFounderApproval, true);
    assert.deepEqual(result.createdProjects, []);
    assert.deepEqual(
      result.projectBooks.map((row) => row.projectId),
      before,
    );
  });

  it("keeps a historical Project Book historical after reconstructed evidence", () => {
    const result = collide([
      evidence({
        evidenceId: "historical-cad",
        text: "Historical CAD-1001 confirmation.",
        sentAt: "2023-05-01T12:00:00.000Z",
      }),
    ]);
    const viewA = result.views.find((row) => row.projectId === PROJECT_A_ID);
    assert.equal(viewA?.lifecycle, "historical_closed");
    assert.equal(viewA?.historicalSafety.remainsHistorical, true);
    assert.equal(viewA?.historicalSafety.becomesActive, false);
    assert.equal(viewA?.historicalSafety.addingEvidenceIsOperational, false);
    assert.deepEqual(viewA?.openJobs, []);
    assert.deepEqual(result.openJobs, []);
    assert.deepEqual(result.chiefOfStaffWrites, []);
    assert.deepEqual(result.canonicalWrites, []);
  });
});

describe("Alea Chedekal multi-project containment", () => {
  it("preserves multi-item Project A and does not merge the later engagement", () => {
    const reconstructed = reconstructProjectBook(aleaChedekalReconstructionInput());
    assert.equal(reconstructed.projectShape, "multi_item");
    assert.equal(
      reconstructed.items.some((item) => item.itemType === "loose_stones"),
      true,
    );
    assert.equal(
      reconstructed.items.some((item) => item.itemType === "bracelet"),
      true,
    );
    const isolation = containIsolatedReconstructedBook(reconstructed, [
      ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
    ]);
    assert.equal(isolation.projectId, ALEA_CHEDEKAL_FIXTURE_PROJECT_ID);
    assert.equal(isolation.siblingBleed, false);
    assert.equal(isolation.mergedInto, null);

    const projectB = aleaChedekalProjectBProtectedThread();
    const result = routeProjectEvidence({
      person: {
        personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
        displayName: "A. Chedekal",
      },
      projectBooks: aleaBooks(),
      evidence: [
        evidence({
          evidenceId: "alea-a-cad",
          personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
          text: `Please see ${ALEA_CHEDEKAL_PROJECT_A_CAD} and Order #${ALEA_CHEDEKAL_PROJECT_A_ORDER}.`,
          threadId: ALEA_CHEDEKAL_FIXTURE_THREAD_ID,
        }),
        evidence({
          evidenceId: "alea-b-cad",
          personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
          text: projectB.messages[0]?.plainText ?? "",
          subject: projectB.messages[0]?.subject ?? null,
          threadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
          artifact: {
            artifactId: "att-necklace-cad",
            itemId: "item-necklace",
            sourceMessageId: "msg-alea-project-b-necklace",
            sourceThreadId: ALEA_CHEDEKAL_PROJECT_B_THREAD_ID,
            filename: "anniversary-necklace-cad.pdf",
            artifactType: "cad_render",
            bytesFetched: false,
          },
        }),
        evidence({
          evidenceId: "alea-hello",
          personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
          subject: "Hello",
          text: "Hello",
        }),
        evidence({
          evidenceId: "other-client",
          personId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          text: "CAD-9999 other client",
        }),
      ],
    });

    const viewA = result.views.find((row) => row.projectId === ALEA_CHEDEKAL_FIXTURE_PROJECT_ID);
    const viewB = result.views.find((row) => row.projectId === ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID);
    assert.ok(viewA);
    assert.ok(viewB);
    assert.equal(viewA.items.length, 2);
    assert.equal(viewB.items.length, 1);
    assert.equal(viewA.lifecycle, "historical_closed");
    assert.equal(viewA.historicalSafety.remainsHistorical, true);
    assert.equal(
      result.attributions.find((row) => row.evidenceId === "alea-a-cad")?.attachedProjectId,
      ALEA_CHEDEKAL_FIXTURE_PROJECT_ID,
    );
    assert.equal(
      result.attributions.find((row) => row.evidenceId === "alea-b-cad")?.attachedProjectId,
      ALEA_CHEDEKAL_FIXTURE_PROJECT_B_ID,
    );
    assert.equal(
      result.attributions.find((row) => row.evidenceId === "alea-hello")?.resolution,
      "person_related_unassigned",
    );
    assert.equal(
      result.attributions.find((row) => row.evidenceId === "other-client")?.resolution,
      "unrelated_rejected",
    );
    assert.equal(viewA.sourceEvidence.some((row) => row.evidenceId === "alea-b-cad"), false);
    assert.equal(viewB.sourceEvidence.some((row) => row.evidenceId === "alea-a-cad"), false);
    assert.equal(viewA.artifacts.some((row) => row.artifactId === "att-necklace-cad"), false);
    assert.equal(viewB.artifacts.some((row) => row.artifactId === "att-necklace-cad"), true);
    assert.deepEqual(result.mergedProjects, []);
    assert.deepEqual(result.createdProjects, []);
    assert.deepEqual(result.deletedProjects, []);
    assert.equal(result.relatedThreadDiscovery.active, false);
    assert.equal(result.relatedThreadDiscovery.autoFetch, false);
    assert.deepEqual(result.relatedThreadDiscovery, RELATED_THREAD_DISCOVERY_HANDOFF);
    assert.deepEqual(result.openJobs, []);
    assert.deepEqual(result.chiefOfStaffWrites, []);
    assert.deepEqual(result.canonicalWrites, []);
    assert.equal(result.automaticApply, false);
    assert.deepEqual(result.mutationBoundary, CONTAINMENT_MUTATION_BOUNDARY);
    for (const flag of Object.values(result.mutationBoundary)) {
      assert.equal(flag, false);
    }
  });
});

describe("related-thread destination contract stays dormant", () => {
  it("does not fetch or attach related-thread candidates", () => {
    const reconstructed = reconstructProjectBook(aleaChedekalReconstructionInput());
    const routed = routeRelatedThreadCandidates(
      reconstructed.relatedThreads.candidates,
      aleaBooks(),
      {
        personId: ALEA_CHEDEKAL_FIXTURE_PERSON_ID,
        displayName: "A. Chedekal",
      },
    );
    assert.equal(reconstructed.relatedThreads.autoFetch, false);
    assert.equal(reconstructed.mutationBoundary.fetchesRelatedThreads, false);
    assert.equal(
      routed.every((row) => row.attachedProjectId === null && row.requiresFounderReview),
      true,
    );
  });
});

describe("containment mutation source boundary", () => {
  it("does not import canonical writers, Gmail fetch, or CoS writes", () => {
    const source = readFileSync(join(DIR, "project-book-containment.ts"), "utf8");
    const fixture = readFileSync(join(DIR, "alea-chedekal-fixture.ts"), "utf8");
    const specificity = readFileSync(join(DIR, "identifier-specificity.ts"), "utf8");
    for (const text of [source, fixture, specificity]) {
      assert.doesNotMatch(text, /correctProjectSpec|applyProjectSpecCorrection|correctProjectKind|saveProjectKindCorrection/);
      assert.doesNotMatch(text, /editPersonProfile|createPersonAtomic|insertEntity\(/);
      assert.doesNotMatch(text, /runExactProjectThreadFetch|getThread\(|listMessages\(/);
      assert.doesNotMatch(text, /\/messages\/[^?\s"'`]+\/attachments\//);
      assert.doesNotMatch(text, /insertSourceNote|writeHumanIntake/);
      assert.doesNotMatch(text, /chief-of-staff|composeChiefOfStaff/);
      assert.doesNotMatch(text, /gmail\.googleapis|users\.messages\.send/);
      assert.doesNotMatch(text, /Apply button/);
      assert.match(text, /automaticApply: false|does not write/i);
    }
  });
});

describe("weak numeric CAD cannot route", () => {
  it("rejects CAD 18, CAD 141, CAD 2024, and CAD 555 as standalone exact matches", () => {
    const books: ExistingProjectBook[] = [
      book({
        projectId: PROJECT_A_ID,
        title: "Numeric CAD book",
        cadJobNumbers: ["18", "141", "2024", "555"],
        subjectTerms: ["invoice"],
      }),
      book({
        projectId: PROJECT_B_ID,
        title: "Unrelated",
        cadJobNumbers: ["CAD-2204"],
      }),
    ];
    for (const token of ["18", "141", "2024", "555"]) {
      const result = routeProjectEvidence({
        person: PERSON,
        projectBooks: books,
        evidence: [
          evidence({
            evidenceId: `weak-cad-${token}`,
            subject: `CAD ${token}`,
            text: `CAD ${token} is in process.`,
          }),
        ],
      });
      const row = result.attributions[0];
      assert.ok(row, token);
      assert.notEqual(row.resolution, "exact_project", token);
      assert.equal(row.attachedProjectId, null, token);
      assert.equal(row.requiresFounderReview, true, token);
      assert.equal(row.score < 80, true, token);
      assert.equal(
        row.reasons.some((reason) => reason.kind === "cad_identifier_weak_numeric"),
        true,
        token,
      );
    }
  });

  it("does not let CAD 141 attach via an unrelated subject containing 141", () => {
    const result = routeProjectEvidence({
      person: PERSON,
      projectBooks: [
        book({
          projectId: PROJECT_A_ID,
          title: "Numeric CAD book",
          cadJobNumbers: ["141"],
        }),
      ],
      evidence: [
        evidence({
          evidenceId: "invoice-141",
          subject: "Invoice 141 reminder",
          text: "Invoice 141 reminder for an unrelated matter.",
        }),
      ],
    });
    assert.notEqual(result.attributions[0]?.resolution, "exact_project");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
  });

  it("still routes a strong structured CAD as exact_project", () => {
    const result = collide([
      evidence({
        evidenceId: "strong-cad",
        text: "Please see CBR2000037 and CAD-2204.",
      }),
    ]);
    const row = result.attributions[0];
    assert.equal(row?.resolution, "exact_project");
    assert.equal(row?.attachedProjectId, PROJECT_B_ID);
    assert.equal(
      row?.reasons.some((reason) => reason.kind === "cad_identifier_strong"),
      true,
    );
  });
});

describe("vendor scoring is never sufficient alone", () => {
  it("does not attach same vendor on an unrelated project", () => {
    const result = collide([
      evidence({
        evidenceId: "vendor-unrelated",
        subject: "Vendor North workshop",
        text: "Checking in from Vendor North.",
        vendorMentions: ["Vendor North"],
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "person_related_unassigned");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(result.attributions[0]?.score < 80, true);
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "vendor_only"),
      true,
    );
  });

  it("lets strong CAD route while vendor only supports", () => {
    const result = collide([
      evidence({
        evidenceId: "vendor-plus-cad",
        text: "CAD-2204 from Vendor North.",
        vendorMentions: ["Vendor North"],
      }),
    ]);
    const row = result.attributions[0];
    assert.equal(row?.resolution, "exact_project");
    assert.equal(row?.attachedProjectId, PROJECT_B_ID);
    assert.equal(
      row?.reasons.some((reason) => reason.kind === "exact_cad_job_identifier"),
      true,
    );
    assert.equal(
      row?.reasons.some((reason) => reason.kind === "vendor_supporting_only"),
      true,
    );
    assert.equal(
      row?.reasons.some((reason) => reason.kind === "vendor_only"),
      false,
    );
  });

  it("rejects same vendor + same Person with no stronger signal", () => {
    const result = collide([
      evidence({
        evidenceId: "vendor-person",
        subject: "Hello",
        text: "Hello from the workshop.",
        vendorMentions: ["Vendor North"],
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "person_related_unassigned");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "person_identity_only"),
      true,
    );
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "vendor_only"),
      true,
    );
  });
});

describe("duplicate identifier collisions", () => {
  const DUP_A = book({
    projectId: PROJECT_A_ID,
    title: "Dup A",
    cadJobNumbers: ["CAD-1001"],
    orderNumbers: ["ORD-5555"],
    artifactRefs: ["shared-artifact-ref"],
    items: [{ itemId: "item-ring", itemType: "ring" }],
  });
  const DUP_B = book({
    projectId: PROJECT_B_ID,
    title: "Dup B",
    cadJobNumbers: ["CAD-1001"],
    orderNumbers: ["ORD-5555"],
    artifactRefs: ["shared-artifact-ref"],
    items: [{ itemId: "item-bracelet", itemType: "bracelet" }],
  });

  function collideDup(
    books: ExistingProjectBook[],
    rows: ProjectEvidenceCandidate[],
  ) {
    return routeProjectEvidence({
      person: PERSON,
      projectBooks: books,
      evidence: rows,
    });
  }

  function assertAmbiguous(result: ReturnType<typeof collideDup>) {
    const row = result.attributions[0];
    assert.ok(row);
    assert.equal(row.resolution, "ambiguous_between_projects");
    assert.equal(row.attachedProjectId, null);
    assert.equal(row.requiresFounderReview, true);
    assert.deepEqual(
      [...row.spanningProjectIds].sort(),
      [PROJECT_A_ID, PROJECT_B_ID].sort(),
    );
  }

  it("treats duplicate CAD as ambiguous regardless of book order", () => {
    const rows = [
      evidence({
        evidenceId: "dup-cad",
        text: "Please see CAD-1001.",
      }),
    ];
    assertAmbiguous(collideDup([DUP_A, DUP_B], rows));
    assertAmbiguous(collideDup([DUP_B, DUP_A], rows));
  });

  it("treats duplicate order as ambiguous regardless of book order", () => {
    const rows = [
      evidence({
        evidenceId: "dup-order",
        text: "Order #ORD-5555 shipped.",
      }),
    ];
    assertAmbiguous(collideDup([DUP_A, DUP_B], rows));
    assertAmbiguous(collideDup([DUP_B, DUP_A], rows));
  });

  it("treats duplicate artifact reference as ambiguous regardless of book order", () => {
    const rows = [
      evidence({
        evidenceId: "dup-artifact",
        kind: "artifact_metadata",
        text: "Shared render attached.",
        artifact: {
          artifactId: "shared-artifact-ref",
          itemId: null,
          sourceMessageId: "msg-dup-artifact",
          sourceThreadId: "thread-dup-artifact",
          filename: "shared-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ];
    assertAmbiguous(collideDup([DUP_A, DUP_B], rows));
    assertAmbiguous(collideDup([DUP_B, DUP_A], rows));
  });

  it("does not pick a project for duplicate weak numeric orders", () => {
    const weakA = book({
      projectId: PROJECT_A_ID,
      title: "Weak order A",
      orderNumbers: ["555"],
    });
    const weakB = book({
      projectId: PROJECT_B_ID,
      title: "Weak order B",
      orderNumbers: ["555"],
    });
    const rows = [
      evidence({
        evidenceId: "dup-weak-order",
        subject: "Order #555",
        text: "Order #555 shipped.",
      }),
    ];
    for (const books of [
      [weakA, weakB],
      [weakB, weakA],
    ]) {
      const result = collideDup(books, rows);
      const row = result.attributions[0];
      assert.ok(row);
      assert.notEqual(row.resolution, "exact_project");
      assert.equal(row.attachedProjectId, null);
      assert.equal(row.requiresFounderReview, true);
      assert.equal(row.resolution, "ambiguous_between_projects");
    }
  });

  it("does not pick a project for duplicate weak short CAD identifiers", () => {
    const weakA = book({
      projectId: PROJECT_A_ID,
      title: "Weak CAD A",
      cadJobNumbers: ["CAD-1"],
    });
    const weakB = book({
      projectId: PROJECT_B_ID,
      title: "Weak CAD B",
      cadJobNumbers: ["CAD-1"],
    });
    const rows = [
      evidence({
        evidenceId: "dup-weak-cad",
        text: "Please see CAD-1.",
      }),
    ];
    for (const books of [
      [weakA, weakB],
      [weakB, weakA],
    ]) {
      const result = collideDup(books, rows);
      const row = result.attributions[0];
      assert.ok(row);
      assert.notEqual(row.resolution, "exact_project");
      assert.equal(row.attachedProjectId, null);
      assert.equal(row.requiresFounderReview, true);
      assert.equal(row.resolution, "ambiguous_between_projects");
    }
  });
});

describe("numeric order and short CAD routing false positives", () => {
  it("does not attach Order #555 as strong identity", () => {
    const result = routeProjectEvidence({
      person: PERSON,
      projectBooks: [
        book({
          projectId: PROJECT_A_ID,
          title: "Numeric order book",
          orderNumbers: ["555"],
        }),
      ],
      evidence: [
        evidence({
          evidenceId: "order-555",
          subject: "Order #555",
          text: "Order number 555 is ready.",
        }),
      ],
    });
    const row = result.attributions[0];
    assert.ok(row);
    assert.notEqual(row.resolution, "exact_project");
    assert.equal(row.attachedProjectId, null);
    assert.equal(row.score < 80, true);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "order_identifier_weak_numeric"),
      true,
    );
    assert.equal(result.possibleNewProjects.length, 0);
  });

  it("does not treat generic subjects containing 555 as order identity", () => {
    const books = [
      book({
        projectId: PROJECT_A_ID,
        title: "Numeric order book",
        orderNumbers: ["555"],
      }),
    ];
    for (const subject of [
      "Invoice 555",
      "Payment 555",
      "Re: 555",
      "Job 555",
      "555 reminder",
      "Invoice AB-555",
    ]) {
      const result = routeProjectEvidence({
        person: PERSON,
        projectBooks: books,
        evidence: [
          evidence({
            evidenceId: `generic-${subject}`,
            subject,
            text: subject,
          }),
        ],
      });
      assert.notEqual(result.attributions[0]?.resolution, "exact_project", subject);
      assert.equal(result.attributions[0]?.attachedProjectId, null, subject);
      assert.equal(
        result.attributions[0]?.reasons.some(
          (reason) => reason.kind === "exact_order_identifier",
        ),
        false,
        subject,
      );
    }
  });

  it("does not attach CAD A-1 from an apartment notice", () => {
    const result = routeProjectEvidence({
      person: PERSON,
      projectBooks: [
        book({
          projectId: PROJECT_A_ID,
          title: "Prefix-stripped CAD",
          cadJobNumbers: ["A-1"],
        }),
      ],
      evidence: [
        evidence({
          evidenceId: "apartment-a1",
          subject: "Apartment A-1 notice",
          text: "Apartment A-1 notice for an unrelated building.",
        }),
      ],
    });
    assert.notEqual(result.attributions[0]?.resolution, "exact_project");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(
      result.attributions[0]?.reasons.some(
        (reason) =>
          reason.kind === "exact_cad_job_identifier" ||
          reason.kind === "cad_identifier_strong",
      ),
      false,
    );
  });

  it("keeps CAD A-1 revision as weak review context, not exact attachment", () => {
    const result = routeProjectEvidence({
      person: PERSON,
      projectBooks: [
        book({
          projectId: PROJECT_A_ID,
          title: "Prefix-stripped CAD",
          cadJobNumbers: ["A-1"],
        }),
      ],
      evidence: [
        evidence({
          evidenceId: "cad-a1-revision",
          subject: "CAD A-1 revision",
          text: "CAD A-1 revision attached.",
        }),
      ],
    });
    const row = result.attributions[0];
    assert.ok(row);
    assert.notEqual(row.resolution, "exact_project");
    assert.equal(row.attachedProjectId, null);
    assert.equal(row.score < 80, true);
    assert.equal(
      row.reasons.some(
        (reason) => reason.kind === "cad_identifier_weak_short_structured",
      ),
      true,
    );
  });
});


describe("itemId project ownership", () => {
  it("accepts a valid same-project itemId", () => {
    const result = collide([
      evidence({
        evidenceId: "item-ok",
        kind: "artifact_metadata",
        text: "CAD-2204 render attached.",
        artifact: {
          artifactId: "att-bracelet-cad",
          itemId: "item-bracelet",
          sourceMessageId: "msg-item-ok",
          sourceThreadId: "thread-project-b",
          filename: "cad-2204-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "exact_project");
    assert.equal(result.attributions[0]?.attachedProjectId, PROJECT_B_ID);
    assert.equal(
      result.attributions[0]?.reasons.some(
        (row) => row.kind === "item_id_owned_by_project",
      ),
      true,
    );
    assert.equal(result.artifacts[0]?.itemId, "item-bracelet");
    assert.equal(result.artifacts[0]?.projectId, PROJECT_B_ID);
    assert.equal(result.artifacts[0]?.reviewState, "assigned");
  });

  it("rejects a foreign itemId across projects without dropping it silently", () => {
    const result = collide([
      evidence({
        evidenceId: "item-foreign",
        kind: "artifact_metadata",
        text: "CAD-2204 render attached.",
        artifact: {
          artifactId: "att-bracelet-cad",
          itemId: "item-ring",
          sourceMessageId: "msg-item-foreign",
          sourceThreadId: "thread-project-b",
          filename: "cad-2204-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ]);
    const row = result.attributions[0];
    assert.ok(row);
    assert.notEqual(row.resolution, "exact_project");
    assert.equal(row.attachedProjectId, null);
    assert.equal(row.requiresFounderReview, true);
    assert.equal(
      row.reasons.some((reason) => reason.kind === "foreign_item_id"),
      true,
    );
    assert.equal(result.artifacts[0]?.itemId, "item-ring");
    assert.equal(result.artifacts[0]?.projectId, null);
    assert.equal(result.artifacts[0]?.reviewState, "needs_review");
    assert.equal(
      result.views
        .find((view) => view.projectId === PROJECT_B_ID)
        ?.artifacts.some((artifact) => artifact.artifactId === "att-bracelet-cad"),
      false,
    );
  });

  it("rejects an unknown itemId", () => {
    const result = collide([
      evidence({
        evidenceId: "item-unknown",
        kind: "artifact_metadata",
        text: "CAD-2204 render attached.",
        artifact: {
          artifactId: "att-bracelet-cad",
          itemId: "item-does-not-exist",
          sourceMessageId: "msg-item-unknown",
          sourceThreadId: "thread-project-b",
          filename: "cad-2204-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ]);
    assert.notEqual(result.attributions[0]?.resolution, "exact_project");
    assert.equal(result.attributions[0]?.attachedProjectId, null);
    assert.equal(
      result.attributions[0]?.reasons.some((row) => row.kind === "unknown_item_id"),
      true,
    );
    assert.equal(result.artifacts[0]?.itemId, "item-does-not-exist");
    assert.equal(result.artifacts[0]?.projectId, null);
    assert.equal(result.artifacts[0]?.reviewState, "needs_review");
  });

  it("allows project-level evidence when no itemId is present", () => {
    const result = collide([
      evidence({
        evidenceId: "item-none",
        kind: "artifact_metadata",
        text: "CAD-2204 render attached.",
        artifact: {
          artifactId: "att-bracelet-cad",
          itemId: null,
          sourceMessageId: "msg-item-none",
          sourceThreadId: "thread-project-b",
          filename: "cad-2204-render.pdf",
          artifactType: "cad_render",
          bytesFetched: false,
        },
      }),
    ]);
    assert.equal(result.attributions[0]?.resolution, "exact_project");
    assert.equal(result.attributions[0]?.attachedProjectId, PROJECT_B_ID);
    assert.equal(result.artifacts[0]?.itemId, null);
    assert.equal(result.artifacts[0]?.projectId, PROJECT_B_ID);
  });
});
