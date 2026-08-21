/**
 * Diamond Studio Agent V1 — containment, event ingest, health, summary.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { EXECUTIVE_REGISTRY, listExecutives } from "../registry";
import { DIAMOND_STUDIO_CONFIGURATION_DEFAULTS } from "@/lib/diamond-studio/configuration";
import { configurationSharePath } from "@/lib/diamond-studio/configuration";
import {
  DIAMOND_STUDIO_AGENT_PRINCIPLES,
  acceptStudioAgentEvent,
  diamondStudioAgentMayExecute,
  identifiedEventFromStoreRecord,
  formatIdentifiedStudioSignal,
  runDiamondStudioHealthChecks,
  STUDIO_CHIEF_OF_STAFF_RELATIONSHIP,
  summarizeIdentifiedStudioActivity,
  summarizeStudioActivity,
  studioHandoffToClientAgent,
  studioHandoffToChiefOfStaff,
  summarizeStudioOperationalExceptions,
  evaluateStudioOperationalConfig,
} from "./index";
import type { StudioAgentAnonymousEvent } from "./types";

describe("Diamond Studio Agent — registry containment", () => {
  it("does not add a sixth executive", () => {
    assert.equal(EXECUTIVE_REGISTRY.length, 5);
    assert.deepEqual(
      listExecutives().map((e) => e.id),
      [
        "chief-of-staff",
        "business-intelligence",
        "search-strategy",
        "content",
        "opportunity",
      ],
    );
  });

  it("is not wired into the Agent OS brief runner", () => {
    const runSrc = readFileSync(
      path.join(process.cwd(), "lib/agent-os/run.ts"),
      "utf8",
    );
    assert.equal(runSrc.includes("diamond-studio-agent"), false);
    assert.equal(runSrc.includes("runDiamondStudioHealthChecks"), false);
  });

  it("reports to the Chief of Staff without founder spam", () => {
    assert.equal(STUDIO_CHIEF_OF_STAFF_RELATIONSHIP.reportsTo, "chief-of-staff");
    assert.equal(
      STUDIO_CHIEF_OF_STAFF_RELATIONSHIP.v1Status,
      "documented-interfaces-only",
    );
    assert.equal(DIAMOND_STUDIO_AGENT_PRINCIPLES.length, 8);
    assert.match(DIAMOND_STUDIO_AGENT_PRINCIPLES[0]!, /Calibration and trust/);
  });
});

describe("Diamond Studio Agent — events", () => {
  const base: StudioAgentAnonymousEvent = {
    event: "studio_snapshot_created",
    timestamp: "2026-08-21T13:00:00.000Z",
    configuration: DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
    sharePath: configurationSharePath(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS),
    snapshotVariant: "clean",
  };

  it("accepts typed anonymous snapshot events", () => {
    const result = acceptStudioAgentEvent(base);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.event.event, "studio_snapshot_created");
      assert.equal(result.event.configuration.metal, "yellow-gold");
    }
  });

  it("ignores unknown events safely", () => {
    const result = acceptStudioAgentEvent({
      ...base,
      event: "studio_mystery_event",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unknown_event");
  });

  it("rejects PII and does not invent identity", () => {
    const email = acceptStudioAgentEvent({
      ...base,
      email: "client@example.com",
    });
    assert.equal(email.ok, false);
    if (!email.ok) assert.equal(email.reason, "pii_rejected");

    const summary = summarizeStudioActivity([base, { ...base, event: "studio_share_card_created" }]);
    assert.equal(summary.identityInvented, false);
    assert.equal(summary.snapshotCount, 2);
    assert.equal(summary.cardCount, 1);
    assert.doesNotMatch(summary.notes.join(" "), /@/);
    assert.equal(
      studioHandoffToClientAgent({
        hasLegitimateIdentity: false,
        matchedByNormalizedEmail: false,
        summary,
      }),
      null,
    );
  });

  it("blocks outreach execution", () => {
    assert.equal(diamondStudioAgentMayExecute("inspect-repository"), true);
    assert.equal(
      diamondStudioAgentMayExecute("email the client about this oval"),
      false,
    );
  });

  it("recognizes studio_view_emailed without inventing purchase intent", () => {
    const gaShaped = acceptStudioAgentEvent({
      event: "studio_view_emailed",
      timestamp: "2026-08-21T14:00:00.000Z",
      configuration: DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      sharePath: configurationSharePath(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS),
      snapshotVariant: "card",
    });
    assert.equal(gaShaped.ok, true);

    const withEmail = acceptStudioAgentEvent({
      event: "studio_view_emailed",
      timestamp: "2026-08-21T14:00:00.000Z",
      configuration: DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      sharePath: configurationSharePath(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS),
      email: "jane@example.com",
    });
    assert.equal(withEmail.ok, false);
    if (!withEmail.ok) assert.equal(withEmail.reason, "pii_rejected");

    const identified = {
      event: "studio_view_emailed" as const,
      id: "evt-1",
      timestamp: "2026-08-21T14:00:00.000Z",
      recipientEmail: "jane@example.com",
      emailNormalized: "jane@example.com",
      emailHash: "abc",
      configuration: {
        ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
        carat: 3,
        metal: "white-gold" as const,
      },
      studioSharePath: "/diamond-studio",
      status: "sent" as const,
      marketingConsent: false as const,
      inquiryCreated: false as const,
    };
    const agentEvent = identifiedEventFromStoreRecord(identified);
    assert.equal(agentEvent.action, "studio_view_emailed");
    assert.doesNotMatch(JSON.stringify(agentEvent), /jane@example\.com/);
    const identifiedSummary = summarizeIdentifiedStudioActivity([identified]);
    assert.equal(identifiedSummary.purchaseIntentInferred, false);
    assert.doesNotMatch(identifiedSummary.notes.join(" "), /ready to buy/i);
    assert.match(identifiedSummary.lines[0]!.maskedEmail, /j•••@example\.com/);
    assert.match(
      formatIdentifiedStudioSignal(identified),
      /One identified visitor emailed a 3\.0 ct Round \/ White Gold configuration/,
    );
    assert.doesNotMatch(
      formatIdentifiedStudioSignal(identified),
      /ready to buy/i,
    );
  });
});

describe("Diamond Studio Agent — health", () => {
  it("passes Studio integrity checks", () => {
    const report = runDiamondStudioHealthChecks();
    const failed = report.checks.filter((c) => !c.ok).map((c) => c.id);
    assert.deepEqual(failed, [], failed.join(", "));
    assert.equal(report.healthy, true);
  });

  it("hands material anonymous signals to CoS, not the founder", () => {
    const events: StudioAgentAnonymousEvent[] = [
      {
        event: "studio_snapshot_created",
        timestamp: "2026-08-21T13:00:00.000Z",
        configuration: DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
        sharePath: "/diamond-studio",
      },
      {
        event: "studio_snapshot_created",
        timestamp: "2026-08-21T13:01:00.000Z",
        configuration: {
          ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
          shape: "oval",
          carat: 2.75,
        },
        sharePath: "/diamond-studio?shape=oval&carat=2.75",
      },
    ];
    const summary = summarizeStudioActivity(events);
    const handoff = studioHandoffToChiefOfStaff(summary);
    assert.ok(handoff);
    assert.equal(handoff?.to, "chief-of-staff");
    assert.equal(handoff?.from, "diamond-studio-agent");
  });

  it("surfaces persistence and sender exceptions without recipient PII", () => {
    const summary = summarizeStudioOperationalExceptions([
      {
        type: "identified-event-persistence-failed",
        timestamp: "2026-08-21T15:00:00.000Z",
        emailsSent: 2,
      },
      {
        type: "visitor-email-sender-unavailable",
        timestamp: "2026-08-21T15:01:00.000Z",
      },
      {
        type: "snapshot-generation-failure",
        timestamp: "2026-08-21T15:02:00.000Z",
      },
    ]);
    assert.equal(summary.containsPii, false);
    assert.match(
      summary.exceptions.join(" "),
      /2 successful Studio emails were sent, but identified-event persistence failed/,
    );
    assert.match(summary.exceptions.join(" "), /Visitor email sender is unavailable/);
    assert.match(summary.exceptions.join(" "), /Snapshot generation failed/);
    assert.doesNotMatch(summary.exceptions.join(" "), /@/);

    const preview = evaluateStudioOperationalConfig({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      RESEND_API_KEY: "re_test",
      STUDIO_VIEW_EMAIL_FROM: "Hourglass Diamonds <studio@example.test>",
    });
    const persistence = preview.checks.find(
      (c) => c.id === "identified-event-persistence",
    );
    assert.equal(persistence?.ok, false);
  });
});
