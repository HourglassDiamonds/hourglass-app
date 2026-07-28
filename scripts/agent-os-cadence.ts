/**
 * Agent OS cadence CLI — dry-run / test / scheduled-live / manual-preview /
 * inspect / resolve-uncertain.
 *
 * Live mode is NEVER implicit — require --scheduled-live or a manual live flag.
 *
 * Mode safety:
 *   --dry-run           Never sends email; fixture adapters only.
 *   --test              Fixture orchestration + durable claim path. Defaults to a
 *                       fake in-process sender (no Resend / no external email).
 *                       Pass --allow-real-email only for an intentional real send.
 *   --scheduled-live    Approved production path (durable Supabase + real email).
 *   --manual-preview    Live production reads + quality gate + HTML render.
 *                       No email. Does not mutate scheduled cadence timestamps
 *                       or claim the official daily delivery window.
 *
 * Usage:
 *   npx tsx scripts/agent-os-cadence.ts --dry-run --force
 *   npx tsx scripts/agent-os-cadence.ts --manual-preview --cadence cos-daily-synthesis
 *   npx tsx scripts/agent-os-cadence.ts --scheduled-live
 *
 * Exit codes: 0 success, 1 failure, 2 invalid args
 */

import {
  createFakeEmailSender,
  executeAgentOsCadence,
  inspectAgentOsDeliveries,
  resolveUncertainDelivery,
  type CadenceRunMode,
} from "../lib/agent-os/cadence-delivery";
import {
  DurableTestPersistenceAdapter,
  createSharedDurableTestBackend,
} from "../lib/agent-os/persistence/adapters/durable-test";
import {
  FileLocalPersistenceAdapter,
  defaultAgentOsStatePath,
  tryCreateSupabasePersistenceAdapter,
} from "../lib/agent-os/persistence";
import { loadEnvLocalForPreview } from "../lib/agent-os/preview-cli";
import { redactSecretsAndPii } from "../lib/agent-os/redaction";
import type { AgentOsPersistenceStore } from "../lib/agent-os/persistence/store";
import { evaluateCadence } from "../lib/agent-os/persistence/evaluate-cadence";
import { getCadenceById } from "../lib/agent-os/persistence/cadence";
import {
  CURRENT_OPERATING_BACKLOG,
  backlogOrientationSummary,
} from "../lib/agent-os/operating-backlog";

async function main() {
  loadEnvLocalForPreview();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const testMode = args.includes("--test");
  const scheduledLive = args.includes("--scheduled-live");
  const manualPreview = args.includes("--manual-preview");
  const inspect = args.includes("--inspect");
  const resolveUncertain = args.includes("--resolve-uncertain");
  const force = args.includes("--force");
  const persistFile = args.includes("--persist-file");
  const persistDurableTest = args.includes("--persist-durable-test");
  const confirm = args.includes("--confirm");
  const allowRealEmail = args.includes("--allow-real-email");

  const modeFlags = [
    dryRun,
    testMode,
    scheduledLive,
    manualPreview,
    inspect,
    resolveUncertain,
  ].filter(Boolean);
  if (modeFlags.length !== 1) {
    console.error(
      "[agent-os-cadence] Pass exactly one of: --dry-run | --test | --scheduled-live | --manual-preview | --inspect | --resolve-uncertain",
    );
    process.exitCode = 2;
    return;
  }

  if (
    (scheduledLive || manualPreview) &&
    (persistFile || args.includes("--persist-memory"))
  ) {
    console.error(
      "[agent-os-cadence] Live / manual modes refuse file-local and memory persistence",
    );
    process.exitCode = 2;
    return;
  }

  if (persistDurableTest && process.env.NODE_ENV === "production") {
    console.error(
      "[agent-os-cadence] durable-test is unavailable in production",
    );
    process.exitCode = 2;
    return;
  }

  if (allowRealEmail && !testMode) {
    console.error(
      "[agent-os-cadence] --allow-real-email is only valid with --test (use --scheduled-live for production)",
    );
    process.exitCode = 2;
    return;
  }

  const cadenceIdx = args.indexOf("--cadence");
  const cadenceId =
    cadenceIdx >= 0 && args[cadenceIdx + 1]
      ? args[cadenceIdx + 1]
      : manualPreview
        ? "cos-daily-synthesis"
        : undefined;

  const deliveryIdx = args.indexOf("--delivery-id");
  const deliveryId =
    deliveryIdx >= 0 && args[deliveryIdx + 1]
      ? args[deliveryIdx + 1]
      : undefined;

  const asIdx = args.indexOf("--as");
  const resolveAs =
    asIdx >= 0 && args[asIdx + 1] ? args[asIdx + 1] : undefined;

  let store: AgentOsPersistenceStore | undefined;
  if (persistDurableTest) {
    store = new DurableTestPersistenceAdapter({
      modeScope: scheduledLive || manualPreview ? "live" : "test",
      shared: createSharedDurableTestBackend({
        modeScope: scheduledLive || manualPreview ? "live" : "test",
      }),
    });
  } else if (persistFile) {
    store = new FileLocalPersistenceAdapter({
      filePath: defaultAgentOsStatePath(),
      modeScope: "live",
    });
  } else if (
    scheduledLive ||
    manualPreview ||
    inspect ||
    resolveUncertain
  ) {
    store =
      tryCreateSupabasePersistenceAdapter({ modeScope: "live" }) ?? undefined;
  }

  if (inspect) {
    if (!store) {
      console.error(
        "[agent-os-cadence] --inspect requires durable store (--persist-durable-test or Supabase env)",
      );
      process.exitCode = 2;
      return;
    }
    const rows = await inspectAgentOsDeliveries(store);
    console.log(JSON.stringify({ deliveries: rows }, null, 2));
    return;
  }

  if (resolveUncertain) {
    if (!store) {
      console.error(
        "[agent-os-cadence] --resolve-uncertain requires durable store",
      );
      process.exitCode = 2;
      return;
    }
    if (!confirm) {
      console.error(
        "[agent-os-cadence] --resolve-uncertain requires explicit --confirm",
      );
      process.exitCode = 2;
      return;
    }
    if (resolveAs !== "sent" && resolveAs !== "failed") {
      console.error("[agent-os-cadence] --as must be sent or failed");
      process.exitCode = 2;
      return;
    }
    if (!deliveryId && !(cadenceId && args.includes("--window"))) {
      console.error(
        "[agent-os-cadence] Provide --delivery-id or --cadence with --window",
      );
      process.exitCode = 2;
      return;
    }
    const windowIdx = args.indexOf("--window");
    const cadenceWindow =
      windowIdx >= 0 && args[windowIdx + 1] ? args[windowIdx + 1] : undefined;
    const record = await resolveUncertainDelivery({
      store,
      deliveryId,
      cadenceId,
      cadenceWindow,
      resolveAs,
      nowIso: new Date().toISOString(),
      note: "CLI operator recovery",
    });
    console.log(
      JSON.stringify(
        {
          deliveryId: record.deliveryId,
          status: record.status,
          kind: record.kind,
          cadenceId: record.cadenceId,
          cadenceWindow: record.cadenceWindow,
          providerMessageId: record.providerMessageId,
          resolutionAudit: record.resolutionAudit,
        },
        null,
        2,
      ),
    );
    return;
  }

  const runMode: CadenceRunMode = manualPreview
    ? "manual-preview"
    : "scheduled";

  const mode = dryRun
    ? ("dry-run" as const)
    : testMode
      ? ("test" as const)
      : ("scheduled-live" as const);

  const testEmailSender =
    testMode && !allowRealEmail ? createFakeEmailSender() : undefined;
  const testEmailConfigOverride =
    testMode && !allowRealEmail
      ? {
          apiKey: "re_test_cli_fake_key",
          from: "agent-os-test@example.com",
          to: "founder-test@example.com",
          recipientAlias: "founder-test",
        }
      : undefined;

  console.log(
    `[agent-os-cadence] mode=${mode} runMode=${runMode} cadence=${cadenceId ?? "(all due)"}${
      testMode
        ? allowRealEmail
          ? " email=real(--allow-real-email)"
          : " email=fake(default)"
        : manualPreview
          ? " email=none(manual-preview)"
          : ""
    }`,
  );

  const orientation = backlogOrientationSummary(CURRENT_OPERATING_BACKLOG);
  if (manualPreview) {
    console.log("[agent-os-cadence] persistent sprint:", orientation.sprintName);
    console.log(
      "[agent-os-cadence] active priorities:",
      orientation.activePriorityTitles.join(" · ") || "(none)",
    );
  }

  const result = await executeAgentOsCadence({
    mode,
    runMode,
    cadenceId,
    force: force || testMode || manualPreview,
    store,
    allowDurableTest: persistDurableTest,
    adapter: persistDurableTest ? "durable-test" : undefined,
    emailSender: testEmailSender,
    emailConfigOverride: testEmailConfigOverride,
    includePreviewRender:
      manualPreview || args.includes("--include-preview"),
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        mode: result.mode,
        runMode: result.runMode ?? runMode,
        cadenceId: result.cadenceId,
        cadenceWindow: result.cadenceWindow,
        officialCadenceWindow: result.officialCadenceWindow ?? null,
        runId: result.runId,
        runStatus: result.runStatus,
        deliveryAction: result.deliveryAction,
        deliveryStatus: result.deliveryStatus,
        emailSent: result.emailSent,
        dryRun: result.dryRun,
        testEmailTransport:
          testMode && !allowRealEmail
            ? "fake"
            : testMode && allowRealEmail
              ? "real"
              : null,
        suppressionReason: result.suppressionReason,
        errorCode: result.errorCode,
        safeSummary: result.safeSummary,
        cadenceLastSuccessfulAtBefore:
          result.cadenceLastSuccessfulAtBefore ?? null,
        cadenceLastSuccessfulAtAfter:
          result.cadenceLastSuccessfulAtAfter ?? null,
        qualityGateOk: result.previewRender?.qualityGateOk ?? null,
        qualityGateCodes: result.previewRender?.qualityGateCodes ?? null,
        recipientAlias: result.previewRender?.recipientAlias ?? null,
        providerMessageId: result.previewRender?.providerMessageId ?? null,
      },
      null,
      2,
    ),
  );

  if (result.previewRender) {
    console.log("\n=== RENDERED SUBJECT ===");
    console.log(result.previewRender.subject);
    console.log("\n=== RENDERED TEXT BODY ===");
    console.log(result.previewRender.text);
    console.log("\n=== RENDERED HTML ===");
    console.log(result.previewRender.html);
  }

  if (manualPreview && store && result.cadenceId) {
    const after = await store.load();
    const cadence =
      after.cadences[result.cadenceId] ?? getCadenceById(result.cadenceId);
    if (cadence) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const probeIso = new Date(
        Date.UTC(
          tomorrow.getUTCFullYear(),
          tomorrow.getUTCMonth(),
          tomorrow.getUTCDate(),
          11,
          5,
          0,
        ),
      ).toISOString();
      const evalNext = evaluateCadence({
        cadence: {
          ...cadence,
          lastSuccessfulAt:
            result.cadenceLastSuccessfulAtAfter ?? cadence.lastSuccessfulAt,
        },
        nowIso: probeIso,
        trigger: "scheduled",
        sourceHealth: [],
      });
      console.log(
        "\n=== SCHEDULED ELIGIBILITY PROOF ===",
        JSON.stringify(
          {
            lastSuccessfulAtUnchanged:
              (result.cadenceLastSuccessfulAtBefore ?? null) ===
              (result.cadenceLastSuccessfulAtAfter ?? null),
            lastSuccessfulAt: result.cadenceLastSuccessfulAtAfter ?? null,
            nextProbeIso: probeIso,
            shouldProceed: evalNext.shouldProceed,
            reasonCodes: evalNext.reasonCodes,
          },
          null,
          2,
        ),
      );
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
  if (
    manualPreview &&
    result.previewRender &&
    !result.previewRender.qualityGateOk
  ) {
    console.error(
      "[agent-os-cadence] Quality gate FAILED — stop before send:",
      result.previewRender.qualityGateCodes.join(", "),
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(
    "[agent-os-cadence] failed:",
    redactSecretsAndPii(String(err)),
  );
  process.exitCode = 1;
});
