import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { composeCosOperatingLoop } from "../../chief-of-staff/operating-loop/compose";
import {
  COS_LOOP_NOW,
  fixtureJob,
  fixtureProjects,
} from "../../chief-of-staff/operating-loop/fixtures";
import { activeLifecycleView } from "../project-lifecycle/view";
import type { ProjectDeskRead, ProjectDeskSummary } from "../project-desk/types";
import type { ProjectDeskOpenJob } from "../project-jobs/types";
import type { ProjectWorkSummary } from "../project-jobs/intelligence";
import type { ProjectKind } from "../project-kind";
import {
  composeCurrentProjectCard,
  composeCurrentProjectCards,
} from "./card";
import { selectOpenProjectWork } from "./select";
import {
  CURRENT_PROJECT_OPERATING_GROUP_IDS,
  CURRENT_PROJECT_OPERATING_GROUP_LABELS,
  allGroupedProjectIds,
  groupCurrentProjects,
  mapLifecycleStageToOperatingGroup,
  operatingGroupForProject,
} from "./operating-groups";

const DIR = dirname(fileURLToPath(import.meta.url));
const NOW = "2026-09-08T18:00:00.000Z";
const PROJECT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PROJECT_E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PROJECT_F = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PROJECT_G = "11111111-1111-4111-8111-111111111111";
const PROJECT_H = "22222222-2222-4222-8222-222222222222";
const JOB_A = "44444444-4444-4444-8444-444444444444";

function emptyWork(): Extract<ProjectWorkSummary, { connected: true }> {
  return {
    connected: true,
    unresolvedCount: 0,
    activeCount: 0,
    deferredCount: 0,
    waitingOn: {
      founder: 0,
      hourglass: 0,
      client: 0,
      vendor: 0,
      unknown: 0,
    },
    blocked: false,
    dueSoonCount: 0,
    pastDueCount: 0,
    forgottenRiskCount: 0,
    nextDueAt: null,
  };
}

function summary(
  extra: Partial<ProjectDeskSummary> & Pick<ProjectDeskSummary, "projectId" | "title">,
): ProjectDeskSummary {
  return {
    projectKind: "custom_new_jewelry",
    people: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "missing",
      specs: "sparse",
      notes: "none",
      jobs: "none",
      files: "none",
      email: "not-connected",
    },
    recordCreatedAt: "2026-08-01T00:00:00.000Z",
    projectWork: emptyWork(),
    lifecycleStage: "production",
    lifecycleLabel: "Production",
    ...extra,
  };
}

function job(
  extra: Partial<ProjectDeskOpenJob> & Pick<ProjectDeskOpenJob, "jobId" | "subject">,
): ProjectDeskOpenJob {
  return {
    kind: "required_action",
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: null,
    associatedPersonName: null,
    state: "open",
    dueAt: null,
    deferredUntil: null,
    createdAt: NOW,
    sourceSystem: "concierge-manual",
    ...extra,
  };
}

function desk(
  extra: Partial<ProjectDeskRead> & Pick<ProjectDeskRead, "projectId" | "title">,
): ProjectDeskRead {
  const projectKind = (extra.projectKind ?? "custom_new_jewelry") as ProjectKind | null;
  const stage =
    extra.lifecycle && extra.lifecycle.kind !== "none"
      ? extra.lifecycle.stage
      : extra.lifecycle === undefined
        ? "production"
        : null;
  return {
    projectKind,
    recordCreatedAt: extra.recordCreatedAt ?? "2026-08-01T00:00:00.000Z",
    people: [],
    specs: [],
    specCorrections: [],
    notes: [],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "missing",
      specs: "sparse",
      notes: "none",
      jobs: "none",
      files: "none",
      email: "not-connected",
    },
    operationalStatus: {
      kind: "unknown",
      evidence: "Email is not connected yet. Current operating state is unknown.",
    },
    operatingLayer: { kind: "none" },
    lifecycle:
      extra.lifecycle ??
      activeLifecycleView({
        projectKind,
        states: projectKind
          ? [
              {
                projectId: extra.projectId,
                projectKind:
                  projectKind === "repair_service" ? "repair_service" : "custom_new_jewelry",
                stage,
                enteredAt: NOW,
                createdAt: NOW,
                updatedAt: NOW,
              },
            ]
          : [],
        events: [],
      }),
    openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
    projectWork: emptyWork(),
    artifacts: { connected: true, items: [], count: 0 },
    ...extra,
  };
}

function lifecycleDesk(
  projectId: string,
  title: string,
  stage: string,
  extra: Partial<ProjectDeskRead> = {},
  enteredAt = NOW,
) {
  return desk({
    projectId,
    title,
    lifecycle: activeLifecycleView({
      projectKind: "custom_new_jewelry",
      states: [
        {
          projectId,
          projectKind: "custom_new_jewelry",
          stage,
          enteredAt,
          createdAt: enteredAt,
          updatedAt: enteredAt,
        },
      ],
      events: [
        {
          eventId: `${projectId.slice(0, 8)}-event-0000-4000-8000-000000000001`,
          projectId,
          projectKind: "custom_new_jewelry",
          priorStage: null,
          newStage: stage,
          changedAt: enteredAt,
          changedBy: "justin",
          sourceSystem: "continuum-reconciliation-v3",
          mutationId: `${projectId.slice(0, 8)}-mutat-0000-4000-8000-000000000001`,
        },
      ],
    }),
    ...extra,
  });
}

function cardFor(
  projectId: string,
  title: string,
  stage: string,
  extraDesk: Partial<ProjectDeskRead> = {},
  enteredAt = NOW,
) {
  const unresolved =
    extraDesk.openJobs && extraDesk.openJobs.connected
      ? extraDesk.openJobs.unresolvedCount
      : 0;
  const row = summary({
    projectId,
    title,
    lifecycleStage: stage,
    projectWork:
      unresolved > 0
        ? { ...emptyWork(), unresolvedCount: unresolved, activeCount: unresolved }
        : emptyWork(),
  });
  const selected = selectOpenProjectWork([row])[0];
  const work = selected ?? {
    projectId,
    title,
    people: [],
    lifecycleStage: stage,
    lifecycleLabel: stage,
    projectWork: row.projectWork,
    href: `/executive-dashboard/concierge/projects/${projectId}`,
  };
  return composeCurrentProjectCard(
    work,
    lifecycleDesk(projectId, title, stage, extraDesk, enteredAt),
  );
}

function titlesIn(groups: ReturnType<typeof groupCurrentProjects>, id: string) {
  return groups.find((group) => group.id === id)?.projects.map((row) => row.title) ?? [];
}

describe("Current Projects operating groups", () => {
  it("maps canonical lifecycle stages and aliases without using labels", () => {
    assert.equal(mapLifecycleStageToOperatingGroup("cad"), "cad_design");
    assert.equal(mapLifecycleStageToOperatingGroup("design"), "cad_design");
    assert.equal(mapLifecycleStageToOperatingGroup("client_approval"), "waiting_for_client");
    assert.equal(mapLifecycleStageToOperatingGroup("waiting_on_client"), "waiting_for_client");
    assert.equal(mapLifecycleStageToOperatingGroup("production"), "in_production");
    assert.equal(mapLifecycleStageToOperatingGroup("in_production"), "in_production");
    assert.equal(mapLifecycleStageToOperatingGroup("waiting_on_vendor"), "waiting_on_shop");
    assert.equal(mapLifecycleStageToOperatingGroup("waiting_on_shop"), "waiting_on_shop");
    assert.equal(mapLifecycleStageToOperatingGroup("ready_for_delivery"), "ready_delivery");
    assert.equal(mapLifecycleStageToOperatingGroup("ready_for_return"), "ready_delivery");
    assert.equal(mapLifecycleStageToOperatingGroup("discovery"), "other_active");
    assert.equal(mapLifecycleStageToOperatingGroup("quality_control"), "other_active");
    assert.equal(mapLifecycleStageToOperatingGroup("mystery_stage"), "other_active");
  });

  it("promotes an in-production Project to YOUR TURN when a founder Open Job exists", () => {
    const withJob = cardFor(PROJECT_A, "Chicken ring (his) / Travis", "production", {
      openJobs: {
        connected: true,
        unresolvedCount: 1,
        unresolved: [
          job({
            jobId: JOB_A,
            subject: "Call shop about missed delivery",
            waitingOnActor: "founder",
          }),
        ],
      },
    });
    assert.equal(withJob.lifecycleStage, "production");
    assert.equal(withJob.founderOwnedUnresolved, true);
    assert.equal(operatingGroupForProject(withJob), "your_turn");
    const grouped = groupCurrentProjects([withJob], { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(titlesIn(grouped, "your_turn"), ["Chicken ring (his) / Travis"]);
    assert.deepEqual(titlesIn(grouped, "in_production"), []);
  });

  it("returns the Project to IN PRODUCTION after the founder action is resolved", () => {
    const before = cardFor(PROJECT_A, "J. Pennock", "production", {
      openJobs: {
        connected: true,
        unresolvedCount: 1,
        unresolved: [
          job({
            jobId: JOB_A,
            subject: "Call shop about missed delivery",
            waitingOnActor: "founder",
          }),
        ],
      },
    });
    const after = cardFor(PROJECT_A, "J. Pennock", "production");
    assert.equal(operatingGroupForProject(before), "your_turn");
    assert.equal(operatingGroupForProject(after), "in_production");
    assert.equal(after.lifecycleStage, "production");
    assert.equal(after.founderOwnedUnresolved, false);
  });

  it("groups CAD, client approval, production, shop, ready, and unknown active states", () => {
    const cards = [
      cardFor(PROJECT_A, "C. Binder", "cad"),
      cardFor(PROJECT_B, "D. Doerner", "client_approval"),
      cardFor(PROJECT_C, "J. Pennock", "production"),
      cardFor(PROJECT_D, "Shop hold", "waiting_on_vendor"),
      cardFor(PROJECT_E, "Delivery ready band", "ready_for_delivery"),
      cardFor(PROJECT_F, "Repair QC", "quality_control"),
    ];
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(
      grouped.map((group) => [group.id, group.count, group.heading]),
      [
        ["cad_design", 1, "CAD / DESIGN · 1"],
        ["waiting_for_client", 1, "WAITING FOR CLIENT · 1"],
        ["waiting_on_shop", 1, "WAITING ON SHOP / VENDOR · 1"],
        ["ready_delivery", 1, "READY / DELIVERY · 1"],
        ["in_production", 1, "IN PRODUCTION · 1"],
        ["other_active", 1, "OTHER ACTIVE · 1"],
      ],
    );
    assert.equal(
      grouped.some((group) => group.id === "your_turn"),
      false,
    );
  });

  it("never drops an active Project and omits empty groups", () => {
    const cards = [
      cardFor(PROJECT_A, "Only CAD", "design"),
      cardFor(PROJECT_B, "Unknown active", "intake"),
    ];
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "mobile" });
    const ids = allGroupedProjectIds(grouped).sort();
    assert.deepEqual(ids, [PROJECT_A, PROJECT_B].sort());
    assert.equal(grouped.some((group) => group.count === 0), false);
    assert.deepEqual(
      grouped.map((group) => group.id),
      ["cad_design", "other_active"],
    );
    for (const id of CURRENT_PROJECT_OPERATING_GROUP_IDS) {
      if (!grouped.some((group) => group.id === id)) {
        assert.equal(CURRENT_PROJECT_OPERATING_GROUP_LABELS[id].includes("· 0"), false);
      }
    }
  });

  it("sorts YOUR TURN by overdue, today, soon, then undated with a stable tie-break", () => {
    const cards = [
      cardFor(PROJECT_A, "Zulu undated", "cad", {
        openJobs: {
          connected: true,
          unresolvedCount: 1,
          unresolved: [job({ jobId: JOB_A, subject: "Undated founder", dueAt: null })],
        },
      }),
      cardFor(PROJECT_B, "Alpha overdue", "production", {
        openJobs: {
          connected: true,
          unresolvedCount: 1,
          unresolved: [
            job({
              jobId: "55555555-5555-4555-8555-555555555555",
              subject: "Overdue founder",
              dueAt: "2026-09-01",
            }),
          ],
        },
      }),
      cardFor(PROJECT_C, "Mid today", "cad", {
        openJobs: {
          connected: true,
          unresolvedCount: 1,
          unresolved: [
            job({
              jobId: "66666666-6666-4666-8666-666666666666",
              subject: "Due today",
              dueAt: "2026-09-08",
            }),
          ],
        },
      }),
      cardFor(PROJECT_D, "Soon tomorrow", "design", {
        openJobs: {
          connected: true,
          unresolvedCount: 1,
          unresolved: [
            job({
              jobId: "77777777-7777-4777-8777-777777777777",
              subject: "Due tomorrow",
              dueAt: "2026-09-09",
            }),
          ],
        },
      }),
    ];
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(titlesIn(grouped, "your_turn"), [
      "Alpha overdue",
      "Mid today",
      "Soon tomorrow",
      "Zulu undated",
    ]);
    const again = groupCurrentProjects([...cards].reverse(), {
      nowIso: NOW,
      viewport: "desktop",
    });
    assert.deepEqual(titlesIn(again, "your_turn"), titlesIn(grouped, "your_turn"));
  });

  it("sorts waiting groups by due follow-up then longest waiting", () => {
    const cards = [
      cardFor(PROJECT_A, "Longest wait", "client_approval", {}, "2026-07-01T00:00:00.000Z"),
      cardFor(
        PROJECT_B,
        "Due follow-up",
        "client_approval",
        {
          openJobs: {
            connected: true,
            unresolvedCount: 1,
            unresolved: [
              job({
                jobId: JOB_A,
                subject: "Nudge client",
                waitingOnActor: "client",
                dueAt: "2026-09-10",
              }),
            ],
          },
        },
        "2026-08-20T00:00:00.000Z",
      ),
      cardFor(PROJECT_C, "Newer wait", "client_approval", {}, "2026-08-01T00:00:00.000Z"),
    ];
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(titlesIn(grouped, "waiting_for_client"), [
      "Due follow-up",
      "Longest wait",
      "Newer wait",
    ]);
  });

  it("groups the current production-shaped Current Projects fixture", () => {
    const chicken = cardFor(PROJECT_A, "Chicken ring (his) / Travis", "cad", {
      openJobs: {
        connected: true,
        unresolvedCount: 1,
        unresolved: [
          job({
            jobId: JOB_A,
            subject:
              "Touch base with Yvonne at 5p about bee engraving and respond about date engraving",
            waitingOnActor: "founder",
          }),
        ],
      },
    });
    const cards = [
      chicken,
      cardFor(PROJECT_B, "C. Binder", "cad"),
      cardFor(PROJECT_C, "D. Doerner", "client_approval"),
      cardFor(PROJECT_D, "J. Pennock", "production"),
      cardFor(PROJECT_E, "K. West — wedding band", "client_approval"),
      cardFor(PROJECT_F, "Lee / Spiegel", "cad"),
      cardFor(PROJECT_G, "M. Rutledge — wedding band", "client_approval"),
      cardFor(PROJECT_H, "S. Leishman", "cad"),
    ];
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.deepEqual(
      grouped.map((group) => [group.id, group.count]),
      [
        ["your_turn", 1],
        ["cad_design", 3],
        ["waiting_for_client", 3],
        ["in_production", 1],
      ],
    );
    assert.deepEqual(titlesIn(grouped, "your_turn"), ["Chicken ring (his) / Travis"]);
    assert.deepEqual(titlesIn(grouped, "cad_design"), [
      "C. Binder",
      "Lee / Spiegel",
      "S. Leishman",
    ]);
    assert.deepEqual(titlesIn(grouped, "waiting_for_client"), [
      "D. Doerner",
      "K. West — wedding band",
      "M. Rutledge — wedding band",
    ]);
    assert.deepEqual(titlesIn(grouped, "in_production"), ["J. Pennock"]);
    assert.equal(allGroupedProjectIds(grouped).length, 8);
  });

  it("places Gmail-created Nate and Abbey in CAD / DESIGN without Gmail-specific grouping", () => {
    const nate = cardFor(PROJECT_A, "Dagger & Pearls Pendant / Necklace", "cad");
    const abbey = cardFor(PROJECT_B, "Matching Marquise Earrings", "cad");
    const grouped = groupCurrentProjects([nate, abbey], {
      nowIso: NOW,
      viewport: "desktop",
    });
    assert.equal(operatingGroupForProject(nate), "cad_design");
    assert.equal(operatingGroupForProject(abbey), "cad_design");
    assert.deepEqual(titlesIn(grouped, "cad_design"), [
      "Dagger & Pearls Pendant / Necklace",
      "Matching Marquise Earrings",
    ]);
    assert.equal(grouped.some((group) => group.id === "your_turn"), false);
    const source = readFileSync(join(DIR, "operating-groups.ts"), "utf8");
    assert.doesNotMatch(source, /gmail|Gmail|intake-candidate|identity-gate/);
  });

  it("groups Gmail-hydrated Current Projects before desks load", () => {
    const cards = composeCurrentProjectCards(
      [
        summary({
          projectId: PROJECT_A,
          title: "Dagger & Pearls Pendant / Necklace",
          lifecycleStage: "cad",
          lifecycleLabel: "CAD",
        }),
        summary({
          projectId: PROJECT_B,
          title: "Matching Marquise Earrings",
          lifecycleStage: "cad",
          lifecycleLabel: "CAD",
        }),
      ],
      new Map(),
    );
    assert.equal(cards.length, 2);
    assert.equal(cards.every((row) => row.founderOwnedUnresolved === false), true);
    const grouped = groupCurrentProjects(cards, { nowIso: NOW, viewport: "mobile" });
    assert.deepEqual(titlesIn(grouped, "cad_design"), [
      "Dagger & Pearls Pendant / Necklace",
      "Matching Marquise Earrings",
    ]);
  });

  it("promotes Abbey into YOUR TURN only after a founder-owned Open Job exists", () => {
    const withoutJob = cardFor(PROJECT_B, "Matching Marquise Earrings", "cad");
    const withJob = cardFor(PROJECT_B, "Matching Marquise Earrings", "cad", {
      openJobs: {
        connected: true,
        unresolvedCount: 1,
        unresolved: [
          job({
            jobId: JOB_A,
            subject: "Confirm flower vs diamond center",
            waitingOnActor: "founder",
          }),
        ],
      },
    });
    assert.equal(operatingGroupForProject(withoutJob), "cad_design");
    assert.equal(operatingGroupForProject(withJob), "your_turn");
    const afterResolve = cardFor(PROJECT_B, "Matching Marquise Earrings", "cad");
    assert.equal(operatingGroupForProject(afterResolve), "cad_design");
  });

  it("does not alter Top 5 ranking or import the CoS ranker", () => {
    const jobs = Array.from({ length: 8 }, (_, index) =>
      fixtureJob({
        jobId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        subject: `Action ${index}`,
        createdAt: `2026-09-0${index + 1}T12:00:00.000Z`,
      }),
    );
    const view = composeCosOperatingLoop({
      jobs,
      projects: fixtureProjects(),
      nowIso: COS_LOOP_NOW,
    });
    assert.equal(view.top5.length, 5);
    assert.equal(new Set(view.top5.map((row) => row.id)).size, 5);
    const source = readFileSync(join(DIR, "operating-groups.ts"), "utf8");
    assert.doesNotMatch(
      source,
      /chief-of-staff|rankActionableWork|composeCosOperatingLoop|COS_TOP_5/,
    );
    const rankSource = readFileSync(
      join(DIR, "../../chief-of-staff/operating-loop/rank.ts"),
      "utf8",
    );
    assert.match(rankSource, /cos-operating-loop-rank-v1/);
  });

  it("keeps membership on the Current Projects selector", () => {
    const completed = summary({
      projectId: PROJECT_A,
      title: "Closed ring",
      lifecycleStage: "completed",
      lifecycleLabel: "Complete",
    });
    const cards = composeCurrentProjectCards(
      [completed],
      new Map([[PROJECT_A, desk({ projectId: PROJECT_A, title: "Closed ring" })]]),
    );
    assert.equal(cards.length, 0);
    assert.deepEqual(groupCurrentProjects(cards, { nowIso: NOW }), []);
  });

  it("expands high-attention groups and uses mobile collapse defaults", () => {
    const cards = [
      cardFor(PROJECT_A, "CAD piece", "cad"),
      cardFor(PROJECT_B, "Production piece", "production"),
      cardFor(PROJECT_C, "QC piece", "quality_control"),
    ];
    const mobile = groupCurrentProjects(cards, { nowIso: NOW, viewport: "mobile" });
    const desktop = groupCurrentProjects(cards, { nowIso: NOW, viewport: "desktop" });
    assert.equal(mobile.find((group) => group.id === "cad_design")?.defaultOpen, true);
    assert.equal(mobile.find((group) => group.id === "in_production")?.defaultOpen, false);
    assert.equal(mobile.find((group) => group.id === "other_active")?.defaultOpen, false);
    assert.equal(desktop.find((group) => group.id === "cad_design")?.defaultOpen, true);
    assert.equal(desktop.find((group) => group.id === "in_production")?.defaultOpen, true);
    assert.equal(desktop.find((group) => group.id === "other_active")?.defaultOpen, true);

    const many = Array.from({ length: 11 }, (_, index) =>
      cardFor(
        `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(index).padStart(2, "0")}`,
        `Production ${index}`,
        "production",
      ),
    );
    const longDesktop = groupCurrentProjects(many, { nowIso: NOW, viewport: "desktop" });
    assert.equal(longDesktop.find((group) => group.id === "in_production")?.defaultOpen, false);
  });
});
