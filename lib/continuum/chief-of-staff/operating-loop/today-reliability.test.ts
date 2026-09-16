import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  dateHasActionableObligation,
  hasCommercialPayload,
  isVendorPerson,
} from "@/lib/continuum/candidates/founder-attention";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/types";
import { InMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import { createInMemoryProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/writer";
import { composeCosOperatingLoop } from "./compose";
import { COS_DOCKET_VISIBLE_LIMIT, composeTodayDocket } from "./docket";
import { disposeDocketItem } from "./disposition";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  fixtureCandidate,
  fixtureJob,
} from "./fixtures";
import { composeConciergeBrief } from "./moderator";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { CosProjectContext } from "./types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const PERSON_BEE = "77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_JUSTIN = "99999999-cccc-4ccc-8ccc-cccccccccccc";
const THREAD = "bee1thread01";

function dateRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    sourceRef: `gc1|${THREAD}|${extra.candidateId}`,
    candidateType: "date",
    proposedTarget: { kind: "none" },
    payload: {
      kind: "date",
      raw: "September 9, 2026",
      isoDate: "2026-09-09",
      precision: "day",
      role: "mentioned",
      sourceTimestamp: COS_LOOP_NOW,
      resolutionCalendar: "source-timestamp-utc-date",
    },
    evidenceBasis: {
      ruleIds: ["explicit_date"],
      matchedText: "September 9, 2026",
    },
    ...extra,
  });
}

describe("Today reliability hotfix", () => {
  it("keeps Bee Engraving as a vendor and Niurka as a person identity", () => {
    assert.equal(
      isVendorPerson({ displayName: "Bee Engraving", roles: [] }),
      true,
    );
    assert.equal(
      isVendorPerson({
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"],
        organizationName: "Vlora",
      }),
      true,
    );
    assert.equal(
      isVendorPerson({ displayName: "Niurka Lulo", roles: ["client"] }),
      false,
    );
    const clientsHome = readFileSync(
      join(ROOT, "app/executive-dashboard/concierge/components/clients-home.tsx"),
      "utf8",
    );
    assert.match(clientsHome, /data-clients-book="clients"/);
    assert.match(clientsHome, /data-clients-book="vendors"/);
    assert.doesNotMatch(clientsHome, /grid-cols-6/);
    const intake = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/gmail-new-project-intake.tsx",
      ),
      "utf8",
    );
    assert.match(intake, /Link vendor/);
    assert.match(intake, /A vendor role is not stored yet/);
  });

  it("excludes the founder as the Bee Engraving thread counterpart", () => {
    const projects = new Map<string, CosProjectContext>([
      [
        COS_LOOP_PROJECT_A,
        {
          projectId: COS_LOOP_PROJECT_A,
          title: "HGD x Bee Engraving",
          personName: null,
          people: [
            { personId: PERSON_JUSTIN, displayName: "Justin", role: "client" },
            {
              personId: PERSON_BEE,
              displayName: "Bee Engraving",
              role: "vendor-contact",
            },
          ],
          isCurrent: true,
          gmailThreadId: THREAD,
        },
      ],
    ]);
    const result = composeConciergeBrief({
      candidates: [
        fixtureCandidate({
          candidateId: "bee-turn",
          sourceRef: `gc1|${THREAD}|bee-turn`,
          sourceTimestamp: "2026-09-06T15:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "design_refinement",
            value: "Re: HGD x Bee Engraving",
          },
          evidenceBasis: {
            ruleIds: ["vendor_shop_update"],
            matchedText: "Bee can start the engraving Monday.",
          },
        }),
        fixtureCandidate({
          candidateId: "justin-assoc",
          sourceRef: `gc1|${THREAD}|justin-assoc`,
          candidateType: "person_association",
          payload: {
            kind: "person_association",
            displayName: "Justin",
            emailHash: "hash",
            mintPerson: false,
            mergePersons: false,
          },
          evidenceBasis: {
            ruleIds: ["gmail_participant"],
            matchedText: "Justin",
          },
        }),
      ],
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    for (const item of result.brief) {
      assert.notEqual(item.personLabel, "Justin");
      assert.doesNotMatch(item.personLabel ?? "", /Justin/i);
      assert.doesNotMatch(`${item.headline} ${item.explanation}`, /Justin/i);
      assert.equal(
        item.actions.some((action) => action.kind === "confirm_person"),
        false,
      );
      for (const beat of item.evidence) {
        assert.doesNotMatch(beat.label, /Justin/i);
      }
    }
  });

  it("does not treat a naked date as a Today action", () => {
    const naked = dateRow({ candidateId: "naked-date" });
    assert.equal(dateHasActionableObligation(naked), false);
    assert.equal(hasCommercialPayload(naked), false);
    const result = composeConciergeBrief({
      candidates: [naked],
      jobs: [],
      projects: new Map(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(
      result.brief.some((item) => /september 9, 2026/i.test(item.headline)),
      false,
    );
    assert.equal(
      result.brief.some((item) => item.rankClass === "deadline_risk"),
      false,
    );
  });

  it("keeps actor + obligation + date eligible", () => {
    const owed = dateRow({
      candidateId: "owed-date",
      payload: {
        kind: "date",
        raw: "September 9, 2026",
        isoDate: "2026-09-09",
        precision: "day",
        role: "deadline",
        sourceTimestamp: COS_LOOP_NOW,
        resolutionCalendar: "source-timestamp-utc-date",
      },
      evidenceBasis: {
        ruleIds: ["explicit_deadline"],
        matchedText: "Sarah needs it by September 9, 2026",
      },
    });
    const approveBy = dateRow({
      candidateId: "approve-by-date",
      evidenceBasis: {
        ruleIds: ["explicit_deadline"],
        matchedText: "Sarah will approve the CAD by September 9, 2026",
      },
    });
    assert.equal(dateHasActionableObligation(owed), true);
    assert.equal(hasCommercialPayload(owed), true);
    assert.equal(dateHasActionableObligation(approveBy), true);
    assert.equal(hasCommercialPayload(approveBy), true);
  });

  it("lets Sarah Responded resolve the waiting-on-client job", async () => {
    const memory = new InMemoryClientMemoryStore();
    const jobs = new InMemoryProjectJobStore();
    const writer = createInMemoryProjectJobWriter(memory, jobs, () => COS_LOOP_NOW);
    const person = await memory.insertEntity({
      kind: "person",
      createdAt: COS_LOOP_NOW,
      createdBy: "test",
    });
    await memory.insertPersonProfile({
      personId: person.record.id,
      displayName: "Sarah Leishman",
      givenName: "Sarah",
      familyName: "Leishman",
      organizationName: null,
      email: null,
      phone: null,
      streetAddress: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      roles: ["client"],
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: COS_LOOP_NOW,
      updatedAt: COS_LOOP_NOW,
    });
    const project = await memory.insertEntity({
      kind: "project",
      createdAt: COS_LOOP_NOW,
      createdBy: "test",
    });
    await memory.insertProjectProfile({
      projectId: project.record.id,
      displayTitle: "Sarah band",
      visibility: "internal-only",
      importRowKey: `sarah:${randomUUID()}`,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: COS_LOOP_NOW,
      updatedAt: COS_LOOP_NOW,
      projectKind: null,
    });
    await memory.insertRelationship({
      id: randomUUID(),
      fromEntityId: person.record.id,
      toEntityId: project.record.id,
      kind: "client-project",
      status: "active",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: COS_LOOP_NOW,
      createdBy: "test",
    });
    const created = await writer.createJob({
      mutationId: randomUUID(),
      projectId: project.record.id,
      kind: "question",
      subject: "Waiting on Sarah",
      waitingOnActor: "client",
      actor: "justin",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const store = new InMemoryCandidateStore();
    const reply = fixtureCandidate({
      candidateId: "sarah-reply",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "client_approval",
        value: "Looks good",
      },
      evidenceBasis: {
        ruleIds: ["client_design_answer"],
        matchedText: "Looks good — go ahead.",
      },
    });
    await store.replace(reply);
    const first = await disposeDocketItem(
      { nowIso: () => COS_LOOP_NOW, candidates: store, jobs: writer },
      {
        verb: "responded",
        origin: "anomaly",
        itemId: `anomaly:client:${created.job.jobId}:${reply.candidateId}`,
        projectId: project.record.id,
        jobId: created.job.jobId,
        candidateIds: [reply.candidateId],
        mutationId: randomUUID(),
        actor: "justin",
      },
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.jobAction, "resolve");
    assert.equal(jobs.getJob(created.job.jobId)?.state, "resolved");

    const repeat = await disposeDocketItem(
      { nowIso: () => COS_LOOP_NOW, candidates: store, jobs: writer },
      {
        verb: "responded",
        origin: "anomaly",
        itemId: `anomaly:client:${created.job.jobId}:${reply.candidateId}`,
        projectId: project.record.id,
        jobId: created.job.jobId,
        candidateIds: [reply.candidateId],
        mutationId: randomUUID(),
        actor: "justin",
      },
    );
    assert.equal(repeat.ok, true);
    assert.equal(jobs.getJob(created.job.jobId)?.state, "resolved");
  });

  it("keeps the Continuum error shell off public site chrome", () => {
    const errorPage = readFileSync(
      join(ROOT, "app/executive-dashboard/error.tsx"),
      "utf8",
    );
    assert.match(errorPage, /data-continuum-error-shell/);
    assert.match(errorPage, /Retry/);
    assert.doesNotMatch(errorPage, /SiteRecovery/);
    assert.doesNotMatch(errorPage, /reach Justin through Concierge/);
  });

  it("disables founder action buttons while pending", () => {
    const source = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/cos-docket-actions.tsx",
      ),
      "utf8",
    );
    assert.match(source, /useFormStatus/);
    assert.match(source, /disabled=\{pending\}/);
    assert.match(source, /item\.anomaly\?\.jobId/);
    assert.match(source, /item\.anomaly\?\.candidateIds/);
  });

  it("keeps simple founder mutations off Sol and Gmail body fetches", () => {
    const source = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/cos-operating-loop-actions.ts",
      ),
      "utf8",
    );
    assert.match(source, /logFounderMutation/);
    assert.doesNotMatch(source, /concierge-sol|runSol|openai/);
    assert.doesNotMatch(source, /gmail\/messages\/|getGmailBody|message body/i);
  });

  it("preserves mobile Home and max-3 Today behavior", () => {
    assert.equal(COS_DOCKET_VISIBLE_LIMIT, 3);
    const loop = composeCosOperatingLoop({
      jobs: Array.from({ length: 6 }, (_, index) =>
        fixtureJob({
          jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
          subject: `Action ${index}`,
        }),
      ),
      nowIso: COS_LOOP_NOW,
      newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    const docket = composeTodayDocket(loop);
    assert.ok(docket.items.length <= 3);
    const hub = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/mobile-home-hub.tsx",
      ),
      "utf8",
    );
    const projects = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/projects-operating-home.tsx",
      ),
      "utf8",
    );
    assert.match(hub, /data-mobile-home/);
    assert.match(projects, /Current Projects|Current work|Projects/);
  });
});
