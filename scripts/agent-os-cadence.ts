/**
 * Agent OS cadence CLI — dry-run / test / scheduled-live / inspect / resolve-uncertain.
 *
 * Live mode is NEVER implicit — require --scheduled-live.
 *
 * Mode safety:
 *   --dry-run         Never sends email; never writes delivery-success as sent.
 *   --test            Fixture orchestration + durable claim path. Defaults to a
 *                     fake in-process sender (no Resend / no external email).
 *                     Pass --allow-real-email only for an intentional real send.
 *   --scheduled-live  Approved production path (durable Supabase + real email).
 *
 * Usage:
 *   npx tsx scripts/agent-os-cadence.ts --dry-run --force
 *   npx tsx scripts/agent-os-cadence.ts --test --cadence cos-weekly-founder-brief --force --persist-durable-test
 *   npx tsx scripts/agent-os-cadence.ts --test --allow-real-email --cadence cos-daily-synthesis --force
 *   npx tsx scripts/agent-os-cadence.ts --scheduled-live
 *   npx tsx scripts/agent-os-cadence.ts --inspect --persist-durable-test
 *   npx tsx scripts/agent-os-cadence.ts --resolve-uncertain --delivery-id del:… --as failed --confirm --persist-durable-test
 *
 * Exit codes: 0 success, 1 failure, 2 invalid args
 */

import {
  createFakeEmailSender,
  executeAgentOsCadence,
  inspectAgentOsDeliveries,
  resolveUncertainDelivery,
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
import { redactSecretsAndPii } from "../lib/agent-os/redaction";
import type { AgentOsPersistenceStore } from "../lib/agent-os/persistence/store";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const testMode = args.includes("--test");
  const scheduledLive = args.includes("--scheduled-live");
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
    inspect,
    resolveUncertain,
  ].filter(Boolean);
  if (modeFlags.length !== 1) {
    console.error(
      "[agent-os-cadence] Pass exactly one of: --dry-run | --test | --scheduled-live | --inspect | --resolve-uncertain",
    );
    process.exitCode = 2;
    return;
  }

  if (scheduledLive && (persistFile || args.includes("--persist-memory"))) {
    console.error(
      "[agent-os-cadence] Scheduled live refuses file-local and memory persistence",
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
      : undefined;

  const deliveryIdx = args.indexOf("--delivery-id");
  const deliveryId =
    deliveryIdx >= 0 && args[deliveryIdx + 1]
      ? args[deliveryIdx + 1]
      : undefined;

  const asIdx = args.indexOf("--as");
  const resolveAs =
    asIdx >= 0 && args[asIdx + 1]
      ? args[asIdx + 1]
      : undefined;

  let store: AgentOsPersistenceStore | undefined;
  if (persistDurableTest) {
    store = new DurableTestPersistenceAdapter({
      modeScope: scheduledLive ? "live" : "test",
      shared: createSharedDurableTestBackend({
        modeScope: scheduledLive ? "live" : "test",
      }),
    });
  } else if (persistFile) {
    store = new FileLocalPersistenceAdapter({
      filePath: defaultAgentOsStatePath(),
      modeScope: "live",
    });
  } else if (scheduledLive || inspect || resolveUncertain) {
    store = tryCreateSupabasePersistenceAdapter({ modeScope: "live" }) ?? undefined;
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
      console.error(
        "[agent-os-cadence] --as must be sent or failed",
      );
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

  const mode = dryRun
    ? ("dry-run" as const)
    : testMode
      ? ("test" as const)
      : ("scheduled-live" as const);

  // --test defaults to a fake sender so fixture runs cannot hit Resend unless
  // the operator explicitly opts into a real send with --allow-real-email.
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
    `[agent-os-cadence] mode=${mode} cadence=${cadenceId ?? "(all due)"}${
      testMode
        ? allowRealEmail
          ? " email=real(--allow-real-email)"
          : " email=fake(default)"
        : ""
    }`,
  );

  const result = await executeAgentOsCadence({
    mode,
    cadenceId,
    force: force || testMode,
    store,
    allowDurableTest: persistDurableTest,
    adapter: persistDurableTest
      ? "durable-test"
      : scheduledLive
        ? undefined
        : undefined,
    emailSender: testEmailSender,
    emailConfigOverride: testEmailConfigOverride,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        mode: result.mode,
        cadenceId: result.cadenceId,
        cadenceWindow: result.cadenceWindow,
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
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
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
