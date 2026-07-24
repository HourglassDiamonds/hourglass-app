/**
 * Safe local preview of the refined daily Chief of Staff email.
 * Fixture sources only · fake sender · no Resend · no production claims.
 *
 * Usage: npx tsx scripts/agent-os-daily-brief-preview.ts
 */

import { runAgentOsBrief } from "../lib/agent-os/run";
import { renderFounderBriefEmail } from "../lib/agent-os/cadence-delivery/render-email";
import { createFakeEmailSender } from "../lib/agent-os/cadence-delivery/send-email";

async function main() {
  const localDate = "2026-07-24";
  const run = await runAgentOsBrief({
    mode: "fixture",
    briefCadenceIntent: "daily",
    briefLocalDate: localDate,
  });

  const rendered = renderFounderBriefEmail({
    run,
    cadenceId: "cos-daily-synthesis",
    cadenceWindow: `day:${localDate}`,
    degraded: run.briefEvidenceQuality === "partial-degraded",
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

  console.log("=== SAFE LOCAL PREVIEW (no Resend, no claim) ===");
  console.log(`Subject: ${rendered.subject}`);
  console.log("--- TEXT BODY ---");
  console.log(rendered.text);
  console.log("--- HTML (truncated) ---");
  console.log(rendered.html.slice(0, 2500));
  console.log("...");
  console.log(
    `Surfaced priorities (${run.brief.surfacedPriorityTitles.length}):`,
  );
  for (const t of run.brief.surfacedPriorityTitles) {
    console.log(`  - ${t}`);
  }
  console.log("Fake sender calls:", sender.calls.length);
  console.log("OK — preview complete; no real email sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
