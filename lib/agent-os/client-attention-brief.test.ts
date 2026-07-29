import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadAllSources } from "./adapters/load";
import {
  CLIENT_ATTENTION_RECOMMENDATION_PREFIX,
  MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES,
} from "./bi/client-attention";
import { renderFounderBriefEmail } from "./cadence-delivery/render-email";
import { runBusinessIntelligence } from "./executives/business-intelligence";
import { runChiefOfStaff } from "./executives/chief-of-staff";
import { loadOperatingBacklog } from "./operating-backlog";
import type { AgentRun } from "./types";

describe("client-attention brief integration", () => {
  it("BI emits client-attention recommendations and CoS caps at 2", async () => {
    const bundle = await loadAllSources("fixture");
    const bi = runBusinessIntelligence(
      bundle,
      { start: "2026-07-22", end: "2026-07-28" },
      { mode: "fixture" },
    );

    assert.ok(bi.clientAttentionAudit);
    assert.equal(bi.clientAttentionAudit.redacted, true);
    const clientRecs = bi.recommendations.filter((r) =>
      r.recommendationId.startsWith(CLIENT_ATTENTION_RECOMMENDATION_PREFIX),
    );
    assert.ok(clientRecs.length >= 1);

    const cos = runChiefOfStaff({
      bi,
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      operatingBacklog: loadOperatingBacklog(),
    });

    const surfacedClient = cos.brief.clientAttentionItems ?? [];
    assert.ok(surfacedClient.length <= MAX_CLIENT_ATTENTION_FOUNDER_PRIORITIES);

    const run = {
      runId: "run-client-attention-brief-test",
      generatedAt: "2026-07-29T15:00:00.000Z",
      mode: "fixture",
      reportingPeriod: { start: "2026-07-22", end: "2026-07-28" },
      executivesInvoked: ["chief-of-staff", "business-intelligence"],
      executivesNotOperational: [],
      sourcesAttempted: ["fixture"],
      sourceHealth: [],
      recommendations: cos.recommendations,
      anomalies: [],
      dataGaps: bi.dataGaps,
      escalationItems: [],
      brief: cos.brief,
      runStatus: "completed",
      recommendationAvailability: "has-material-recommendations",
      executiveStatuses: [],
      briefEvidenceQuality: "full",
      warnings: [],
      deliveryGuidance: {
        shouldSendFounderEmail: true,
        quietReason: null,
        quietCategory: null,
      },
      briefSurfacing: {
        highestRoiRecommendationId: null,
        additionalPriorityRecommendationIds: [],
      },
      durationMs: 1,
      agentOsVersion: "1.0.0",
    } as unknown as AgentRun;

    const email = renderFounderBriefEmail({
      run,
      cadenceId: "cos-daily-synthesis",
      cadenceWindow: "2026-07-29",
      degraded: false,
    });
    if (surfacedClient.length) {
      assert.match(email.html, /Client Attention/i);
      assert.match(email.text, /Client Attention/i);
    }
    assert.doesNotMatch(email.html, /@clients\.example\.test/i);
    assert.doesNotMatch(email.text, /fixture-contact-/i);
    assert.doesNotMatch(email.html, /Dear Sarah,/i);
  });
});
