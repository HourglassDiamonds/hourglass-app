import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  COS_DOCKET_TITLE,
  TODAY_DOCKET_VERSION,
  type CosTodayDocketView,
} from "./docket";
import type { TodayBriefingPacket } from "./briefing-packet";
import type { CosBriefingV1 } from "./cos-briefing-v1";
import type { CosDocketItemView, CosWatchingItem } from "./types";
import {
  acceptModelFeedback,
  buildCosFeedbackPacket,
  presentCosFeedback,
  refreshCosFeedback,
  resetCosFeedbackCache,
} from "@/lib/continuum/cos-feedback/feedback";

const NOW = "2026-09-23T14:00:00.000Z";

function packet(partial: Partial<TodayBriefingPacket> & Pick<TodayBriefingPacket, "displayName">): TodayBriefingPacket {
  return {
    itemId: partial.itemId ?? partial.displayName.toLowerCase(),
    displayName: partial.displayName,
    entityType: partial.entityType ?? "client",
    briefingKind: partial.briefingKind ?? "client_work",
    projectName: partial.projectName ?? null,
    projectId: partial.projectId === undefined ? "project" : partial.projectId,
    personId: null,
    organizationLabel: null,
    vendorContactName: null,
    identifiers: [],
    lifecycle: null,
    latestMeaningfulExternalEvent: null,
    latestMeaningfulFounderAction: null,
    ballHolder: partial.ballHolder ?? "founder",
    unresolvedFounderObligation: null,
    externalCommitment: null,
    nextExpectedEvent: null,
    candidateNextAction: null,
    uncertainty: [],
    mustNotState: [],
    sourceRefs: partial.sourceRefs ?? ["gmail:thread-1"],
  };
}

function briefing(partial: Partial<CosBriefingV1>): CosBriefingV1 {
  return {
    modelId: "cos-briefing-v1",
    currentState: partial.currentState ?? "Review the CAD.",
    timingFacts: partial.timingFacts ?? [],
    timingProse: null,
    checkpoint: partial.checkpoint ?? null,
    checkpointProse: "",
    why: null,
    currentFounderAction: partial.currentFounderAction ?? true,
  };
}

function focus(input: {
  id: string;
  name: string;
  state?: string;
  projectId?: string | null;
  entityType?: TodayBriefingPacket["entityType"];
  briefingKind?: TodayBriefingPacket["briefingKind"];
  ball?: TodayBriefingPacket["ballHolder"];
  subject?: string;
  context?: string;
  cos?: Partial<CosBriefingV1>;
}): CosDocketItemView {
  return {
    id: input.id,
    lane: "live_work",
    origin: "brief",
    subject: input.subject ?? input.name,
    headline: input.state ?? "Review the CAD.",
    context: input.context ?? null,
    job: null,
    brief: null,
    decision: null,
    anomaly: null,
    briefingPacket: packet({
      itemId: input.id,
      displayName: input.name,
      projectId: input.projectId === undefined ? "project" : input.projectId,
      entityType: input.entityType,
      briefingKind: input.briefingKind,
      ballHolder: input.ball,
      sourceRefs: [`gmail:${input.id}`],
    }),
    cosBriefing: briefing({ currentState: input.state, ...input.cos }),
  };
}

function watching(input: {
  id: string;
  name: string;
  ball?: TodayBriefingPacket["ballHolder"];
  state?: string;
  cos?: Partial<CosBriefingV1>;
}): CosWatchingItem {
  return {
    id: input.id,
    title: input.name,
    detail: input.state ?? "With the shop.",
    projectId: "project",
    briefingPacket: packet({
      itemId: input.id,
      displayName: input.name,
      ballHolder: input.ball ?? "vendor_shop",
      sourceRefs: [`gmail:${input.id}`],
    }),
    cosBriefing: briefing({
      currentState: input.state ?? "With the shop.",
      currentFounderAction: false,
      ...input.cos,
    }),
  };
}

function docket(items: CosDocketItemView[], rows: CosWatchingItem[] = []): CosTodayDocketView {
  return {
    todayDocketVersion: TODAY_DOCKET_VERSION,
    title: COS_DOCKET_TITLE,
    items,
    queuedCount: 0,
    watchingCount: rows.length,
    watching: rows,
    showCaughtUp: items.length === 0,
    showDisconnected: false,
    caughtUpHeading: "Caught up",
    caughtUpDetail: null,
    disconnectedHeading: null,
    disconnectedDetail: null,
  };
}

describe("cos feedback v1", () => {
  it("keeps evidence facts and labels recommendations separately", () => {
    const board = docket([
      focus({
        id: "tim",
        name: "Tim",
        state: "The shop started the job.",
        cos: {
          currentFounderAction: false,
          timingFacts: [
            {
              kind: "quoted_lead_time",
              statement: "Estimated roughly ten business days from Sept. 17.",
              anchorDate: "2026-09-17",
              dueDate: null,
              leadBusinessDays: 10,
              sourceRefs: ["gmail:tim"],
            },
          ],
          checkpoint: {
            dueAt: null,
            dueDate: "2026-09-30",
            condition: "If there is still no CAD",
            action: "Bring it back into focus",
            reason: null,
            sourceRefs: ["gmail:tim"],
            status: "advisory",
            basis: "recommendation",
          },
        },
      }),
    ]);
    const built = buildCosFeedbackPacket({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    const feedback = presentCosFeedback({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    assert.equal(built.items[0]?.timingFacts[0]?.statement, "Estimated roughly ten business days from Sept. 17.");
    assert.equal(feedback.risks.find((risk) => risk.basis === "evidence")?.statement, "Estimated roughly ten business days from Sept. 17.");
    assert.equal(feedback.risks.find((risk) => risk.basis === "recommendation")?.basis, "recommendation");
    assert.doesNotMatch(feedback.founderGuidance, /\bscheduled\b/i);
  });

  it("rejects a model due date that the packet does not contain", () => {
    const board = docket([focus({ id: "duane", name: "Duane", state: "Review the CAD." })]);
    const packet = buildCosFeedbackPacket({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    const accepted = acceptModelFeedback(packet, {
      portfolioSummary: "You have one real founder action.",
      founderGuidance: "Duane is due December 25.",
      focusOrder: [{ itemId: "duane", why: "Review the CAD." }],
      safeToIgnore: [],
    });
    assert.equal(accepted, null);
  });

  it("does not let safe-to-ignore hide due founder work", () => {
    const board = docket(
      [
        focus({
          id: "duane",
          name: "Duane",
          state: "Review the CAD.",
          cos: {
            currentFounderAction: true,
            checkpoint: {
              dueAt: null,
              dueDate: "2026-09-23",
              condition: "CAD is waiting",
              action: "Review it",
              reason: null,
              sourceRefs: ["gmail:duane"],
              status: "advisory",
              basis: "recommendation",
            },
          },
        }),
      ],
      [watching({ id: "sarah", name: "Sarah" })],
    );
    const packet = buildCosFeedbackPacket({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    assert.equal(packet.items.find((item) => item.itemId === "duane")?.founderDue, true);
    const accepted = acceptModelFeedback(packet, {
      portfolioSummary: "You have one real founder action.",
      founderGuidance: "Sarah can wait.",
      focusOrder: [],
      safeToIgnore: [{ itemId: "duane", why: "Ignore Duane." }],
    });
    assert.equal(accepted, null);
    const feedback = presentCosFeedback({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    assert.equal(feedback.safeToIgnore.some((row) => row.itemId === "duane"), false);
    assert.equal(feedback.focusOrder[0]?.itemId, "duane");
  });

  it("keeps client founder work ahead of internal SEO", () => {
    const board = docket([
      focus({ id: "duane", name: "Duane", state: "Review the CAD." }),
      focus({
        id: "seo",
        name: "SEO",
        subject: "SEO landing page refresh",
        state: "Update the landing page.",
        projectId: null,
        entityType: "unknown",
        briefingKind: "generic",
      }),
    ]);
    const packet = buildCosFeedbackPacket({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    const accepted = acceptModelFeedback(packet, {
      portfolioSummary: "Focus SEO first.",
      founderGuidance: "Do the landing page before Duane.",
      focusOrder: [
        { itemId: "seo", why: "Update the landing page." },
        { itemId: "duane", why: "Review the CAD." },
      ],
      safeToIgnore: [],
    });
    assert.equal(accepted, null);
    const feedback = presentCosFeedback({ docket: board, sourceWatermark: "w1", nowIso: NOW });
    assert.equal(feedback.focusOrder[0]?.itemId, "duane");
  });

  it("falls back when the model fails and reuses the same digest", async () => {
    resetCosFeedbackCache();
    let calls = 0;
    const board = docket([focus({ id: "duane", name: "Duane", state: "Review the CAD." })]);
    const model = async () => {
      calls += 1;
      throw new Error("unavailable");
    };
    const first = await refreshCosFeedback({
      docket: board,
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    const second = await refreshCosFeedback({
      docket: board,
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    assert.equal(calls, 1);
    assert.match(first.founderGuidance, /Duane/);
    assert.equal(second.founderGuidance, first.founderGuidance);
    assert.equal(first.focusOrder.length > 0, true);
  });

  it("regenerates when the portfolio state changes", async () => {
    resetCosFeedbackCache();
    let calls = 0;
    const model = async () => {
      calls += 1;
      return {
        portfolioSummary: "You have one real founder action.",
        founderGuidance: "Duane first: Review the CAD.",
        focusOrder: [{ itemId: "duane", why: "Review the CAD." }],
        safeToIgnore: [],
      };
    };
    await refreshCosFeedback({
      docket: docket([focus({ id: "duane", name: "Duane", state: "Review the CAD." })]),
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    await refreshCosFeedback({
      docket: docket([focus({ id: "duane", name: "Duane", state: "Files are delivered." })]),
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    assert.equal(calls, 2);
  });

  it("shares one in-flight model call for the same digest", async () => {
    resetCosFeedbackCache();
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const board = docket([focus({ id: "duane", name: "Duane", state: "Review the CAD." })]);
    const model = async () => {
      calls += 1;
      await gate;
      return {
        portfolioSummary: "You have one real founder action.",
        founderGuidance: "Duane first: Review the CAD.",
        focusOrder: [{ itemId: "duane", why: "Review the CAD." }],
        safeToIgnore: [],
      };
    };
    const first = refreshCosFeedback({
      docket: board,
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    const second = refreshCosFeedback({
      docket: board,
      sourceWatermark: "w1",
      nowIso: NOW,
      model,
    });
    assert.equal(calls, 1);
    release?.();
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left.founderGuidance, right.founderGuidance);
    assert.equal(calls, 1);
  });

  it("keeps raw Gmail text out of the model packet and performs no canonical write", () => {
    const item = focus({
      id: "duane",
      name: "Duane",
      state: "Review the CAD.",
      context: "RAW GMAIL BODY\n> quoted history",
    });
    (item as { sourceEvents?: unknown }).sourceEvents = [{ authorOwnedText: "RAW GMAIL BODY" }];
    const built = buildCosFeedbackPacket({
      docket: docket([item]),
      sourceWatermark: "w1",
      nowIso: NOW,
    });
    const serialized = JSON.stringify(built);
    assert.doesNotMatch(serialized, /RAW GMAIL BODY|authorOwnedText|quotedText|sourceEvents/);
    const source = readFileSync(join(process.cwd(), "lib/continuum/cos-feedback/feedback.ts"), "utf8");
    assert.doesNotMatch(source, /supabase|\.from\(|createProjectJob|mintPerson|insert\(/);
    const today = readFileSync(
      join(process.cwd(), "app/executive-dashboard/concierge/components/chief-of-staff-today.tsx"),
      "utf8",
    );
    assert.match(today, /data-cos-feedback/);
    assert.match(today, /docket\.title/);
  });
});
