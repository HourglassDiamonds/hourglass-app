/**
 * Safe local preview of the revised daily Chief of Staff Morning Brief.
 * Uses the current persistent operating backlog + fixture sources.
 * Distinguishes verified facts / persistent commitments / recommendations / hypotheses.
 * No Resend · no production claims.
 *
 * Usage: npx tsx scripts/agent-os-daily-brief-preview.ts
 */

import { runAgentOsBrief } from "../lib/agent-os/run";
import { renderFounderBriefEmail } from "../lib/agent-os/cadence-delivery/render-email";
import { createFakeEmailSender } from "../lib/agent-os/cadence-delivery/send-email";
import { dailyTodayCall } from "../lib/agent-os/brief-quality";
import { evaluateBriefQualityGate } from "../lib/agent-os/brief-quality-gate";
import { evaluateDeliveryEligibility } from "../lib/agent-os/cadence-delivery/eligibility";
import {
  CURRENT_OPERATING_BACKLOG,
  backlogOrientationSummary,
} from "../lib/agent-os/operating-backlog";

async function main() {
  const localDate = "2026-07-28";
  const run = await runAgentOsBrief({
    mode: "fixture",
    briefCadenceIntent: "daily",
    briefLocalDate: localDate,
    operatingBacklog: CURRENT_OPERATING_BACKLOG,
  });

  const rendered = renderFounderBriefEmail({
    run,
    cadenceId: "cos-daily-synthesis",
    cadenceWindow: `day:${localDate}`,
    degraded: run.briefEvidenceQuality === "partial-degraded",
  });

  const todayCall = dailyTodayCall({
    whyItMatters: run.brief.whyItMatters,
    highestRoiAction: run.brief.highestRoiAction,
    sprintOrientation: run.brief.sprintOrientation,
    whatChanged: run.brief.whatChanged,
  });
  const quality = evaluateBriefQualityGate({
    brief: run.brief,
    todayCall,
    opportunityWatch: run.brief.opportunityToWatch,
    intent: "daily",
  });
  const eligibility = evaluateDeliveryEligibility({
    run: {
      ...run,
      deliveryGuidance:
        run.deliveryGuidance === "send-nothing"
          ? "send-normal-brief"
          : run.deliveryGuidance,
    },
    persistenceOk: true,
    intent: "daily",
  });

  const sender = createFakeEmailSender({ messageId: "preview-no-send" });
  await sender({
    config: {
      apiKey: "re_fake_preview_only",
      from: "Agent OS Preview <preview@updates.example.test>",
      to: "[redacted-preview@example.test]",
      recipientAlias: "preview-founder",
      recipientConfigFingerprint: "preview-fingerprint-not-production",
    },
    rendered,
    idempotencyKey: "preview-no-production-claim",
  });

  const orientation = backlogOrientationSummary(CURRENT_OPERATING_BACKLOG);

  console.log("=== SAFE LOCAL PREVIEW (no Resend, no claim) ===");
  console.log(`Subject: ${rendered.subject}`);
  console.log(`Quality gate: ${quality.ok ? "PASS" : "FAIL"}`);
  if (!quality.ok) {
    for (const v of quality.violations) {
      console.log(`  - ${v.code}: ${v.detail}`);
    }
  }
  console.log(`Delivery eligibility: ${eligibility.action} (${eligibility.reason})`);
  console.log("");
  console.log("--- SOURCE LEGEND ---");
  console.log("[Persistent] Master sprint commitments (authoritative)");
  console.log("[Verified] Fixture/sample evidence treated as verified for preview");
  console.log("[Recommendation] Founder-facing CoS recommendation");
  console.log("[Hypothesis] Labeled inference — not a verified fact");
  console.log("");
  console.log(`[Persistent] Sprint: ${orientation.sprintName}`);
  console.log(`[Persistent] Objective: ${orientation.objective}`);
  console.log(
    `[Persistent] Active priorities: ${orientation.activePriorityTitles.join(" · ") || "(none)"}`,
  );
  console.log(
    `[Persistent] Open decisions: ${orientation.openDecisionTitles.join(" · ") || "(none)"}`,
  );
  console.log("");
  console.log("--- TEXT BODY ---");
  console.log(rendered.text);
  console.log("");
  console.log("--- HTML ---");
  console.log(rendered.html);
  console.log("");
  console.log("Fake sender calls:", sender.calls.length);
  console.log("OK — preview complete; no real email sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
