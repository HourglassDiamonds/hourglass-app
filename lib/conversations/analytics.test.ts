import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConversationAnalyticsPayload,
  buildConversationConciergeHref,
  resolveNewProgressMilestones,
  sanitizeConversationAnalyticsValue,
} from "./analytics";

describe("conversation analytics", () => {
  it("fires each progress milestone only once", () => {
    const fired = new Set<number>();
    const first = resolveNewProgressMilestones(30, fired);
    assert.deepEqual(first, [25]);
    for (const milestone of first) fired.add(milestone);

    const second = resolveNewProgressMilestones(80, fired);
    assert.deepEqual(second, [50, 75]);
    for (const milestone of second) fired.add(milestone);

    const third = resolveNewProgressMilestones(95, fired);
    assert.deepEqual(third, [90]);
    for (const milestone of third) fired.add(milestone);

    const fourth = resolveNewProgressMilestones(99, fired);
    assert.deepEqual(fourth, []);
  });

  it("rejects PII-like values from analytics payloads", () => {
    assert.equal(
      sanitizeConversationAnalyticsValue("person@example.com", 80),
      undefined,
    );
    assert.equal(
      sanitizeConversationAnalyticsValue("+1 (704) 555-0199", 80),
      undefined,
    );

    const payload = buildConversationAnalyticsPayload({
      episode_slug: "why-we-re-here",
      season: 1,
      episode_number: 1,
      video_provider: "youtube",
      progress_milestone: 25,
      destination_type: "article",
      destination_path: "/diamond-guide/why-work-with-a-graduate-gemologist",
    });

    assert.deepEqual(payload, {
      episode_slug: "why-we-re-here",
      season: 1,
      episode_number: 1,
      video_provider: "youtube",
      progress_milestone: 25,
      destination_type: "article",
      destination_path: "/diamond-guide/why-work-with-a-graduate-gemologist",
    });
    assert.equal("email" in payload, false);
    assert.equal("phone" in payload, false);
    assert.equal("transcript" in payload, false);
  });

  it("preserves related-resource analytics destination fields", () => {
    const payload = buildConversationAnalyticsPayload({
      episode_slug: "why-we-re-here",
      season: 1,
      episode_number: 1,
      video_provider: "none",
      destination_type: "tool",
      destination_path: "/diamond-intelligence",
    });

    assert.equal(payload.destination_type, "tool");
    assert.equal(payload.destination_path, "/diamond-intelligence");
    assert.equal(payload.episode_slug, "why-we-re-here");
  });

  it("builds Concierge CTA attribution with tool=conversations and content slug", () => {
    assert.equal(
      buildConversationConciergeHref("why-we-re-here"),
      "/concierge?tool=conversations&content=why-we-re-here",
    );
  });
});
