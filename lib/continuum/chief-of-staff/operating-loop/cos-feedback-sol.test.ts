import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { conciergeForegroundModel } from "@/lib/continuum/concierge-sol/models";
import type { CosFeedbackPacket } from "@/lib/continuum/cos-feedback/feedback";
import { requestCosFeedbackCompletion } from "@/lib/continuum/cos-feedback/sol-request";

const packet: CosFeedbackPacket = {
  modelId: "cos-feedback-v1",
  sourceWatermark: "w1",
  generatedAt: "2026-09-23T14:00:00.000Z",
  items: [
    {
      itemId: "duane",
      displayName: "Duane",
      projectId: "project",
      projectTitle: "Duane",
      sourceRefs: ["gmail:duane"],
      currentState: "Review the CAD.",
      ballHolder: "founder",
      currentFounderAction: true,
      founderDue: false,
      clientFacing: true,
      lane: "focus",
      timingFacts: [],
      checkpointBasis: null,
      checkpointStatement: null,
    },
  ],
};

describe("cos feedback sol request", () => {
  it("sends only the bounded packet to gpt-5.6-sol and does not retry", async () => {
    let calls = 0;
    let body: Record<string, unknown> | null = null;
    const result = await requestCosFeedbackCompletion({
      apiKey: "test-key",
      model: conciergeForegroundModel(),
      packet,
      fetchImpl: async (_url, init) => {
        calls += 1;
        body = JSON.parse(String(init?.body));
        assert.equal(init?.headers && (init.headers as Record<string, string>).authorization, "Bearer test-key");
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              portfolioSummary: "You have one real founder action.",
              founderGuidance: "Duane first: Review the CAD.",
            }),
          }),
          { status: 200 },
        );
      },
    });
    assert.equal(calls, 1);
    assert.equal(body?.model, "gpt-5.6-sol");
    assert.equal(body?.tools, undefined);
    assert.equal(body?.input, JSON.stringify(packet));
    assert.doesNotMatch(String(body?.input), /authorOwnedText|quotedText|sourceEvents|OPENAI_API_KEY/);
    assert.equal((result as { founderGuidance: string }).founderGuidance, "Duane first: Review the CAD.");
  });

  it("fails closed on a timeout without a second attempt", async () => {
    let calls = 0;
    await assert.rejects(
      requestCosFeedbackCompletion({
        apiKey: "test-key",
        model: "gpt-5.6-sol",
        packet,
        timeoutMs: 20,
        fetchImpl: (_url, init) =>
          new Promise((_resolve, reject) => {
            calls += 1;
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      }),
    );
    assert.equal(calls, 1);
  });

  it("keeps the adapter server-only and off the render and poll paths", () => {
    const root = process.cwd();
    const adapter = readFileSync(join(root, "lib/continuum/cos-feedback/sol-adapter.ts"), "utf8");
    const today = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/chief-of-staff-today.tsx"),
      "utf8",
    );
    const poll = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx"),
      "utf8",
    );
    const probe = readFileSync(
      join(root, "app/executive-dashboard/concierge/today-read-model-actions.ts"),
      "utf8",
    );
    const page = readFileSync(join(root, "app/executive-dashboard/concierge/page.tsx"), "utf8");
    const settle = readFileSync(
      join(root, "app/executive-dashboard/concierge/components/cos-feedback-settle.tsx"),
      "utf8",
    );
    const action = readFileSync(
      join(root, "app/executive-dashboard/concierge/cos-feedback-actions.ts"),
      "utf8",
    );
    assert.match(adapter, /import "server-only"/);
    assert.match(adapter, /getConciergeOpenAiApiKey/);
    assert.doesNotMatch(adapter, /NEXT_PUBLIC_/);
    assert.match(page, /CosFeedbackSettle/);
    assert.match(settle, /settleCosFeedback/);
    assert.doesNotMatch(settle, /setInterval|OPENAI_API_KEY/);
    assert.match(today, /presentCosFeedback/);
    assert.doesNotMatch(today, /refreshCosFeedback|sol-adapter|OPENAI_API_KEY/);
    assert.doesNotMatch(poll, /settleCosFeedback|sol-adapter|OPENAI_API_KEY/);
    assert.doesNotMatch(probe, /settleCosFeedback|sol-adapter|OPENAI_API_KEY/);
    assert.match(action, /cosFeedbackSolModel/);
    assert.match(action, /cosFeedbackSolRoute/);
    assert.match(action, /cosFeedbackIsCached/);
    assert.match(action, /noteCosFeedbackUnavailable/);
    assert.match(action, /noteCosFeedbackCacheHit/);
    assert.doesNotMatch(action, /console\.(log|info|debug|warn|error)/);
    assert.doesNotMatch(action, /sourceEvents|authorOwnedText/);
  });
});
