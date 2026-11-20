import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import type { ClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import { createInMemoryClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import {
  recordSterlingFounderDirective,
  sterlingFounderDirectiveFromNote,
  sterlingFounderDirectiveNote,
  validateSterlingFounderDirective,
} from "./founder-directive";
import { applySterlingFounderAuthority } from "./founder-authority";
import { decideOperationalBoardRow } from "./operational-board-decision";
import { buildSterlingTodayWorkingSet } from "./working-set";
import { validateSterlingTodayProposal } from "./validate";
import {
  AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS,
  authorizedNovember20FounderDirectives,
} from "./authorized-founder-updates-2026-11-20";
import {
  STERLING_TODAY_PROPOSAL_VERSION,
  type SterlingFounderDirectiveRecord,
  type SterlingTodayProposal,
} from "./types";

const DIRECTIVE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function directive(): SterlingFounderDirectiveRecord {
  return {
    directiveId: DIRECTIVE_ID,
    workUnitId: `project:${PROJECT_ID}`,
    projectId: PROJECT_ID,
    personId: PERSON_ID,
    sourceRefs: ["gmail:thread:1234567890ab:message:1234567890ac"],
    recordedAt: "2026-10-30T13:00:00.000Z",
    recordedBy: "founder:test",
    lifecycleStage: "cad",
    waitingOn: "client",
    attentionPriority: "monitor",
    relationshipRole: "client",
    disposition: "active",
    operationalSubstage: "CAD approved",
    fulfilledObligationIds: ["shop-final-cad", "founder-cad-review"],
    resolvedJobIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
    reason: "Founder confirmed CAD and an October 29 client wait.",
  };
}

describe("Sterling founder directive persistence", () => {
  it("requires exact canonical identity binding", () => {
    assert.ok(validateSterlingFounderDirective(directive()));
    assert.equal(validateSterlingFounderDirective({
      ...directive(),
      workUnitId: "project:dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }), null);
  });

  it("validates an exact partial completion without requiring project closure", () => {
    const partial = {
      ...directive(),
      lifecycleStage: undefined,
      waitingOn: undefined,
      attentionPriority: undefined,
      relationshipRole: undefined,
      disposition: undefined,
    };
    assert.ok(validateSterlingFounderDirective(partial));
    assert.equal(validateSterlingFounderDirective({
      ...partial,
      resolvedJobIds: ["not-a-job-id"],
    }), null);
  });

  it("uses the directive UUID as an idempotency key and retains an auditable payload", async () => {
    const writes = new Map<string, string>();
    const writer: Pick<ClientMemoryNoteWriter, "addManualNote"> = {
      async addManualNote(input) {
        const prior = writes.get(input.submissionId);
        if (prior && prior !== input.noteText) return { ok: false, reason: "idempotency-conflict" };
        writes.set(input.submissionId, input.noteText);
        return { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: prior ? "already-present" : "inserted" };
      },
    };
    const first = await recordSterlingFounderDirective({ writer, directive: directive() });
    const replay = await recordSterlingFounderDirective({ writer, directive: directive() });
    assert.deepEqual(first, { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "inserted" });
    assert.deepEqual(replay, { ok: true, noteId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "already-present" });
    assert.match(writes.get(DIRECTIVE_ID) ?? "", /Sterling founder directive v1/);
    assert.match(sterlingFounderDirectiveNote(directive()), /October 29 client wait/);
  });
});

describe("local founder update save and fresh-board replay", () => {
  it("reads generic saved updates back through manual notes and rebuilds Morgan and James", async (context) => {
    const ledger = JSON.parse(readFileSync(
      "docs/sterling/local-founder-updates-2026-11-20.json",
      "utf8",
    )) as { version: string; updates: unknown[] };
    assert.equal(ledger.version, "sterling-local-founder-updates-v1");
    const updates = ledger.updates.map((row) => validateSterlingFounderDirective(row));
    assert.equal(updates.every(Boolean), true);
    assert.deepEqual(
      authorizedNovember20FounderDirectives().map((row) => row.directiveId),
      [...AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS],
    );

    const store = new InMemoryClientMemoryStore();
    const writer = createInMemoryClientMemoryNoteWriter(store);
    for (const [id, kind] of [
      ["9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd", "person"],
      ["3c845863-81c3-4391-9346-1dd18091c0af", "person"],
      ["6c47edeb-33f8-4aa7-bb38-53bbe023fcc3", "project"],
    ] as const) {
      await store.insertEntity({ id, kind, createdAt: "2026-11-19T00:00:00.000Z", createdBy: "local-replay" });
    }
    await store.insertRelationship({
      id: "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3",
      fromEntityId: "9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd",
      toEntityId: "6c47edeb-33f8-4aa7-bb38-53bbe023fcc3",
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: "2026-11-19T00:00:00.000Z",
      createdBy: "local-replay",
    });
    for (const update of updates) {
      assert.ok(update);
      const recorded = await recordSterlingFounderDirective({ writer, directive: update });
      assert.equal(recorded.ok, true);
    }

    // This clone is the process boundary: a fresh build sees only serialized SourceNotes.
    const savedNotes = structuredClone(store.listSourceNotes());
    const reloaded = savedNotes.map(sterlingFounderDirectiveFromNote).filter(
      (row): row is SterlingFounderDirectiveRecord => row !== null,
    );
    assert.equal(reloaded.length, 2);

    const morganProjectId = "6c47edeb-33f8-4aa7-bb38-53bbe023fcc3";
    const morganPersonId = "9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd";
    const jamesPersonId = "3c845863-81c3-4391-9346-1dd18091c0af";
    const reminderJobId = "a92280a3-4041-4072-af8e-79e068ca2a0e";
    const projects: ProjectDeskSummary[] = [{
      projectId: morganProjectId,
      title: "Morgan Jines — Engagement Ring",
      projectKind: "custom_new_jewelry",
      people: [{ personId: morganPersonId, displayName: "Morgan Jines", roles: ["client"], organizationName: null }],
      specs: [
        { fieldName: "cad_job_number", label: "CAD", value: "C026937" },
        { fieldName: "order_number", label: "Order", value: "RN08576" },
      ],
      latestNoteAt: "2026-11-19T22:00:00.000Z",
      latestNotePreview: null,
      coverage: { people: "available", specs: "available", notes: "available", jobs: "available", files: "none", email: "not-connected" },
      recordCreatedAt: "2026-11-01T00:00:00.000Z",
      projectWork: {} as never,
      lifecycleStage: "cad",
      lifecycleLabel: "CAD",
      gmailThreadId: null,
    }];
    const jobs: ProjectJob[] = [{
      jobId: reminderJobId,
      projectId: morganProjectId,
      kind: "required_action",
      subject: "Old Morgan follow-up reminder",
      detail: null,
      waitingOnActor: "founder",
      associatedPersonId: morganPersonId,
      state: "open",
      dueAt: null,
      deferredUntil: null,
      resolvedAt: null,
      cancelledAt: null,
      createdAt: "2026-11-19T00:00:00.000Z",
      updatedAt: "2026-11-19T00:00:00.000Z",
      createdBy: "local-replay",
      sourceSystem: "continuum",
      sourceRef: null,
      createdMutationId: "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4",
    }];
    const set = buildSterlingTodayWorkingSet({
      runId: "fresh-local-founder-update-replay",
      sourceWatermark: "november-19-baseline-plus-local-founder-updates",
      generatedAt: "2026-11-20T14:10:00.000Z",
      projects,
      jobs,
      candidates: [],
      threadContext: new Map(),
      knownPeople: [
        { personId: morganPersonId, displayName: "Morgan Jines", roles: ["client"], organizationName: null, emailHash: "a".repeat(64) },
        { personId: jamesPersonId, displayName: "James Bowron", roles: ["client"], organizationName: null, emailHash: "b".repeat(64) },
      ],
      founderDirectives: reloaded,
    });
    const morganUnit = set.workUnits.find((row) => row.projectId === morganProjectId)!;
    const jamesUnit = set.workUnits.find((row) => row.workUnitId === "provisional:02bb0d6fa4b4ac390a8aa326")!;
    assert.ok(morganUnit);
    assert.equal(jamesUnit.label, "CR5001205");
    assert.deepEqual(jamesUnit.threadIds, ["192ba533c7869445"]);
    const morganEvidence = set.evidence.find((row) => row.founderDirective?.directiveId.startsWith("a1a1"))!;
    const jamesEvidence = set.evidence.find((row) => row.founderDirective?.directiveId.startsWith("b2b2"))!;

    const raw: SterlingTodayProposal = {
      contractVersion: STERLING_TODAY_PROPOSAL_VERSION,
      runId: set.runId,
      evidenceSnapshotId: set.evidenceSnapshotId,
      generatedAt: set.generatedAt,
      portfolioAssessments: [
        {
          workUnitId: morganUnit.workUnitId,
          projectId: morganProjectId,
          identityStatus: "canonical_project",
          todayDisposition: "presented",
          recommendationItemId: "stale-morgan-cad-chase",
          currentStage: { canonicalLifecycleStage: "cad", operationalSubstage: "Awaiting final CAD", responsibleParty: "vendor_shop", confidence: "medium", explanation: "Pre-update state.", evidenceRefs: [morganEvidence.evidenceId] },
          obligations: [
            { obligationId: "shop-final-cad", description: "Shop delivers final CAD.", status: "open", responsibleParty: "vendor_shop", confidence: "medium", evidenceRefs: [morganEvidence.evidenceId] },
            { obligationId: "founder-cad-review", description: "Justin reviews final CAD.", status: "open", responsibleParty: "founder", confidence: "medium", evidenceRefs: [morganEvidence.evidenceId] },
          ],
          nextStepOwner: "vendor_shop",
          attentionPriority: "monitor",
          confidence: "medium",
          evidenceRefs: [morganEvidence.evidenceId],
          ambiguities: [],
          explanation: "Pre-update state.",
          omissionReason: null,
        },
        {
          workUnitId: jamesUnit.workUnitId,
          projectId: null,
          identityStatus: "provisional_evidence",
          todayDisposition: "ambiguous",
          recommendationItemId: null,
          currentStage: { canonicalLifecycleStage: null, operationalSubstage: null, responsibleParty: "unknown", confidence: "low", explanation: "Pre-update state.", evidenceRefs: [jamesEvidence.evidenceId] },
          obligations: [],
          nextStepOwner: "unknown",
          attentionPriority: "no_attention",
          confidence: "low",
          evidenceRefs: [jamesEvidence.evidenceId],
          ambiguities: ["Current owner unresolved."],
          explanation: "Pre-update state.",
          omissionReason: "Current owner unresolved.",
        },
      ],
      recommendations: [{
        itemId: "stale-morgan-cad-chase",
        workUnitId: morganUnit.workUnitId,
        category: "waiting_on_shop",
        projectId: morganProjectId,
        personId: morganPersonId,
        relationshipRole: "client",
        title: "Morgan CAD",
        summary: "Chase and review the CAD.",
        attentionPriority: "monitor",
        confidence: "medium",
        explanation: "Pre-update state.",
        evidenceRefs: [morganEvidence.evidenceId],
        ambiguities: [],
        obligations: [],
      }],
      relationshipProposals: [],
      proposedCanonicalMutations: [],
      portfolioAmbiguities: [],
    };
    const rebuilt = applySterlingFounderAuthority(set, raw);
    assert.equal(validateSterlingTodayProposal(set, rebuilt).accepted, true);

    const recommendationByUnit = new Map(rebuilt.recommendations.map((row) => [row.workUnitId, row] as const));
    const localRows = rebuilt.portfolioAssessments.map((assessment) => {
      const directive = set.evidence.find((row) => row.founderDirective?.workUnitId === assessment.workUnitId)
        ?.founderDirective ?? null;
      const decision = decideOperationalBoardRow({
        nextStepOwner: assessment.nextStepOwner,
        todayDisposition: assessment.todayDisposition,
        lifecycle: assessment.currentStage.canonicalLifecycleStage,
        obligations: assessment.obligations,
        recommendation: recommendationByUnit.get(assessment.workUnitId) ?? null,
        evidenceComplete: true,
      });
      return {
        project: assessment.workUnitId === morganUnit.workUnitId ? "Morgan — C026937 / RN08576" : "James — CR5001205",
        projectsStage: assessment.currentStage.operationalSubstage,
        lifecycle: assessment.currentStage.canonicalLifecycleStage,
        lifecycleEffectiveOn: directive?.lifecycleEffectiveOn ?? null,
        productionEstimate: directive?.productionEstimate ?? null,
        today: decision.disposition,
        next: decision.owner,
        todayObligations: decision.outstandingObligations.map((row) => row.description),
        rememberedObligations: assessment.obligations.map((row) => ({
          id: row.obligationId,
          status: row.status,
          responsibleParty: row.responsibleParty,
          description: row.description,
        })),
      };
    });
    assert.deepEqual(localRows, [
      {
        project: "Morgan — C026937 / RN08576",
        projectsStage: "In production · Production ETA pending",
        lifecycle: "production",
        lifecycleEffectiveOn: "2026-11-20",
        productionEstimate: { status: "pending", completionOn: null, quotedLeadTime: null, sourceRef: null },
        today: "waiting_on_shop",
        next: "vendor_shop",
        todayObligations: ["Shop completes production and returns the finished piece."],
        rememberedObligations: [
          { id: "shop-final-cad", status: "fulfilled", responsibleParty: "vendor_shop", description: "Shop delivered the final CAD on November 19 at about 5–6 p.m. ET." },
          { id: "founder-cad-review", status: "fulfilled", responsibleParty: "founder", description: "Justin approved the final CAD on the morning of November 20." },
          { id: "shop-production-completion", status: "open", responsibleParty: "vendor_shop", description: "Shop completes production and returns the finished piece." },
        ],
      },
      {
        project: "James — CR5001205",
        projectsStage: "Waiting on shop; founder video due upon receipt",
        lifecycle: null,
        lifecycleEffectiveOn: null,
        productionEstimate: null,
        today: "waiting_on_shop",
        next: "vendor_shop",
        todayObligations: ["Shop finishes and returns the CR5001205 ring."],
        rememberedObligations: [
          { id: "shop-finish-return-cr5001205", status: "open", responsibleParty: "vendor_shop", description: "Shop finishes and returns the CR5001205 ring." },
          { id: "founder-video-on-receipt-cr5001205", status: "open", responsibleParty: "founder", description: "Justin sends James a video after receipt of the finished CR5001205 ring." },
        ],
      },
    ]);
    context.diagnostic(`FRESH_LOCAL_BOARD ${JSON.stringify(localRows)}`);
  });
});
