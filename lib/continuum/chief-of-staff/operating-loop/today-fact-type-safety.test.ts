import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate } from "./fixtures";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-18T13:00:00.000Z";
const TRAVIS_PROJECT = "travis-chicken-ring-project";
const TRAVIS_PERSON = "travis-morse-person-id";
const TRAVIS_SHIP_THREAD = "19ffcce49298efeb";
const TRAVIS_SHIP_MSG = "1a08c4df80609947";
const JEN_PROJECT = "jen-spiegel-cad-project";
const JEN_PERSON = "jen-spiegel-person-id";
const JEN_THREAD = "19fc9f4c3d36dbed";
const NATE_THREAD = "19a854e42f90344f";
const NATE_IN = "nate-in-19a854e42f90344f";
const NATE_EMAIL = "nate.pearl@example.test";
const NATE_HASH = hashEmail(NATE_EMAIL)!;
const NATE_ID = "nate-pearl-person-id-000000000000000001";
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;

const NATE_LIVE_INBOUND = [
  "1. estimated cost comparison:",
  "- actual pearls",
  "- platinum beadwork",
  "2. chain options:",
  "- pictures/videos",
  "- pricing",
  "3. he likes adjustable length with jump ring",
].join("\n");

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    ...extra,
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  options?: {
    projects?: Map<string, CosProjectContext>;
    threadContext?: Map<string, TodayGmailThreadContext>;
    vendorDirectory?: readonly string[];
    knownPeople?: Parameters<typeof composeCosOperatingLoop>[0]["knownPeople"];
  },
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: options?.projects ?? new Map(),
    nowIso: NOW,
    threadContext: options?.threadContext,
    vendorDirectory: options?.vendorDirectory,
    knownPeople: options?.knownPeople,
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function travisProject(): Map<string, CosProjectContext> {
  return new Map([
    [
      TRAVIS_PROJECT,
      {
        projectId: TRAVIS_PROJECT,
        title: "Chicken ring",
        personName: "Travis Morse",
        people: [
          { personId: TRAVIS_PERSON, displayName: "Travis Morse", role: "client" },
        ],
        isCurrent: true,
        lifecycleStage: "production",
        specs: [{ fieldName: "finger_size", value: "12.5" }],
        gmailThreadId: TRAVIS_SHIP_THREAD,
      },
    ],
  ]);
}

function jenProject(stage = "cad"): Map<string, CosProjectContext> {
  return new Map([
    [
      JEN_PROJECT,
      {
        projectId: JEN_PROJECT,
        title: "Lee / Spiegel",
        personName: "Jen Spiegel",
        people: [{ personId: JEN_PERSON, displayName: "Jen Spiegel", role: "client" }],
        isCurrent: true,
        lifecycleStage: stage,
        specs: [{ fieldName: "cad_job_number", value: "C025964" }],
        gmailThreadId: JEN_THREAD,
      },
    ],
  ]);
}

function sizeCandidate(extra: Partial<ContinuumCandidate> = {}): ContinuumCandidate {
  return gmailRow({
    candidateId: "travis-size-11",
    sourceRef: `gc1|${TRAVIS_SHIP_THREAD}|${TRAVIS_SHIP_MSG}`,
    sourceTimestamp: "2026-09-10T12:00:00.000Z",
    candidateType: "structured_spec",
    candidateState: "conflict",
    proposedTarget: {
      kind: "project_spec",
      projectId: TRAVIS_PROJECT,
      fieldName: "finger_size",
    },
    payload: {
      kind: "structured_spec",
      fieldName: "finger_size",
      proposedValue: "11",
      currentValue: "12.5",
      conflict: true,
      sourceProvenance: "UNKNOWN",
    },
    evidenceBasis: {
      ruleIds: ["spec_conflict_review_required", "explicit_finger_size"],
      matchedText: "finger size 11",
    },
    ...extra,
  });
}

describe("Today type-safe fact conflicts", () => {
  it("TRAVIS: untrusted size 11 does not conflict with canonical 12.5", () => {
    for (const candidate of [
      sizeCandidate(),
      sizeCandidate({
        candidateId: "travis-size-11-unstamped",
        payload: {
          kind: "structured_spec",
          fieldName: "finger_size",
          proposedValue: "11",
          currentValue: "12.5",
          conflict: true,
        },
      }),
    ]) {
      const { docket, loop } = todayOf([candidate], { projects: travisProject() });
      const hay = docket.items
        .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
        .join("\n");
      assert.doesNotMatch(hay, /Update to 11|latest evidence says 11/i);
      assert.equal(
        loop.brief.some((item) => item.specConflict?.proposedValue === "11"),
        false,
      );
      assert.equal(
        docket.items.some((item) =>
          selectFounderControls(item).actions.some((action) =>
            /Update to 11/i.test(action.label),
          ),
        ),
        false,
      );
    }
  });

  it("TRAVIS: later explicit person-bound size still conflicts", () => {
    const { docket, loop } = todayOf(
      [
        sizeCandidate({
          candidateId: "travis-size-7",
          sourceRef: "gc1|19aabbccddeeff01|1a08c4df80601111",
          sourceTimestamp: "2026-09-17T15:00:00.000Z",
          payload: {
            kind: "structured_spec",
            fieldName: "finger_size",
            proposedValue: "7",
            currentValue: "6.5",
            conflict: true,
            sourceProvenance: "EXACT",
          },
          evidenceBasis: {
            ruleIds: ["spec_conflict_review_required", "explicit_finger_size"],
            matchedText: "actually make it 7",
          },
        }),
      ],
      {
        projects: new Map([
          [
            TRAVIS_PROJECT,
            {
              ...travisProject().get(TRAVIS_PROJECT)!,
              specs: [{ fieldName: "finger_size", value: "6.5" }],
            },
          ],
        ]),
      },
    );
    assert.ok(
      loop.brief.some((item) => item.specConflict?.proposedValue === "7"),
    );
    assert.match(
      docket.items.map((item) => item.headline).join(" "),
      /finger size/i,
    );
  });

  it("JEN: C025964 and RN08318 coexist without a CAD conflict card", () => {
    const candidates = [
      gmailRow({
        candidateId: "jen-rn-as-cad",
        sourceRef: `gc1|${JEN_THREAD}|niurka-sep17`,
        sourceTimestamp: "2026-09-17T18:00:00.000Z",
        candidateType: "structured_spec",
        candidateState: "conflict",
        proposedTarget: {
          kind: "project_spec",
          projectId: JEN_PROJECT,
          fieldName: "cad_job_number",
        },
        payload: {
          kind: "structured_spec",
          fieldName: "cad_job_number",
          proposedValue: "RN08318",
          currentValue: "C025964",
          conflict: true,
        },
        evidenceBasis: {
          ruleIds: ["exact_cad_job", "spec_conflict_review_required"],
          matchedText: "job RN08318",
        },
      }),
      gmailRow({
        candidateId: "jen-workshop-ctx",
        sourceRef: `gc1|${JEN_THREAD}|niurka-sep17`,
        sourceTimestamp: "2026-09-17T18:00:00.000Z",
        candidateType: "project_context",
        proposedTarget: { kind: "project", projectId: JEN_PROJECT },
        payload: {
          kind: "project_context",
          topic: "workshop_job_id",
          value: "RN08318",
        },
        evidenceBasis: {
          ruleIds: ["exact_workshopJobId"],
          matchedText: "RN08318",
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates, {
      projects: jenProject("cad"),
      vendorDirectory: [NIURKA_HASH],
      threadContext: new Map([
        [
          JEN_THREAD,
          {
            subject: "RE: HGD x Tim/Jenn-C025964-RN08318",
            fromDisplayName: "Niurka",
            fromEmail: NIURKA_EMAIL,
            messages: [
              {
                messageId: "niurka-sep17",
                sentAt: "2026-09-17T18:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
            ],
          },
        ],
      ]),
      knownPeople: [
        {
          personId: JEN_PERSON,
          displayName: "Jen Spiegel",
          roles: ["client"],
        },
      ],
    });
    const hay = docket.items
      .map((item) => `${item.subject} ${item.headline} ${item.context ?? ""}`)
      .join("\n");
    assert.doesNotMatch(hay, /CAD job number|Update to RN08318|Keep C025964/i);
    assert.equal(
      loop.brief.some((item) => item.specConflict?.proposedValue === "RN08318"),
      false,
    );
    assert.equal(
      docket.items.some((item) => /Jen Spiegel/i.test(item.subject) && /CAD|RN08318/i.test(item.headline)),
      false,
    );
  });

  it("genuine CAD replacement on the same typed field still conflicts", () => {
    const { loop } = todayOf(
      [
        gmailRow({
          candidateId: "jen-cad-replace",
          sourceRef: `gc1|${JEN_THREAD}|cad-replace`,
          sourceTimestamp: "2026-09-17T18:00:00.000Z",
          candidateType: "structured_spec",
          candidateState: "conflict",
          proposedTarget: {
            kind: "project_spec",
            projectId: JEN_PROJECT,
            fieldName: "cad_job_number",
          },
          payload: {
            kind: "structured_spec",
            fieldName: "cad_job_number",
            proposedValue: "C026111",
            currentValue: "C025964",
            conflict: true,
            sourceProvenance: "EXACT",
          },
          evidenceBasis: {
            ruleIds: ["exact_cad_job", "spec_conflict_review_required"],
            matchedText: "C026111",
          },
        }),
      ],
      { projects: jenProject("cad") },
    );
    assert.ok(
      loop.brief.some((item) => item.specConflict?.proposedValue === "C026111"),
    );
  });
});

describe("Today obligation-specific copy", () => {
  it("NATE: latest inbound cost comparison + chain asks is specific, not recap", () => {
    const candidates = [
      gmailRow({
        candidateId: "nate-live-ask",
        sourceRef: `gc1|${NATE_THREAD}|${NATE_IN}`,
        sourceTimestamp: "2026-09-17T16:00:00.000Z",
        candidateType: "open_job",
        proposedTarget: { kind: "open_job", projectId: null },
        payload: {
          kind: "open_job",
          jobKind: "request",
          subject: "estimated cost comparison pearls vs platinum beadwork",
          detail: NATE_LIVE_INBOUND,
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: {
          ruleIds: ["explicit_client_request"],
          matchedText: NATE_LIVE_INBOUND,
        },
      }),
    ];
    const { docket, loop } = todayOf(candidates, {
      threadContext: new Map([
        [
          NATE_THREAD,
          {
            subject: "Re: Pearl pendant",
            fromDisplayName: "Nate Pearl",
            fromEmail: NATE_EMAIL,
            messages: [
              {
                messageId: NATE_IN,
                sentAt: "2026-09-17T16:00:00.000Z",
                direction: "inbound",
                fromEmailHash: NATE_HASH,
              },
            ],
          },
        ],
      ]),
      knownPeople: [
        {
          personId: NATE_ID,
          displayName: "Nate Pearl",
          roles: ["client"],
          emailHash: NATE_HASH,
        },
      ],
    });
    const card = docket.items.find((item) =>
      /Nate|Pearl|pearl|chain/i.test(`${item.subject} ${item.headline} ${item.context ?? ""}`),
    );
    assert.ok(card);
    assert.match(
      card?.headline ?? "",
      /Price pearl vs platinum beadwork and send chain options/i,
    );
    assert.doesNotMatch(card?.headline ?? "", /Send the recap/i);
    assert.match(
      card?.context ?? "",
      /cost difference between pearl and platinum beadwork/i,
    );
    assert.equal(loop.brief.length > 0 || docket.items.length > 0, true);
  });
});
