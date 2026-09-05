import { randomUUID } from "node:crypto";
import {
  composeStudioSnapshot,
  type StudioSnapshotResult,
} from "@/lib/diamond-studio/snapshot";
import {
  configurationSharePath,
  snapshotDownloadFilename,
  type DiamondStudioConfiguration,
} from "@/lib/diamond-studio/configuration";
import { parseEmailViewJsonBody, readHoneypotFromJson, studioViewEmailHash } from "./validate";
import { checkStudioEmailRateLimit, STUDIO_EMAIL_RATE_LIMIT_ERROR } from "./rate-limit";
import { renderStudioViewEmail, STUDIO_CARD_CONTENT_ID } from "./render-email";
import {
  isStudioViewEmailConfigured,
  resolveStudioViewEmailFrom,
  resendStudioViewEmailSender,
} from "./send";
import { persistStudioViewEmailed, type StudioPersistResult } from "./store";
import {
  STUDIO_VIEW_EMAIL_SUBJECT,
  type HandleEmailStudioViewResult,
  type StudioViewEmailSender,
  type StudioViewEmailedRecord,
} from "./types";
import { releaseStudioSnapshotBuffer } from "./release-snapshot";
import {
  recordStudioOperationalSignal,
} from "@/lib/agent-os/diamond-studio/operational";
import {
  ingestStudioViewEmailedBestEffort,
  mapStudioConfiguration,
  recordIdentifiedPersistenceFailedBestEffort,
} from "@/lib/continuum/ingest";
import { tryCreateContinuumStore } from "@/lib/continuum/persistence";
import type { ContinuumStore } from "@/lib/continuum/persistence";

const VISITOR_RETRY =
  "We couldn’t send that just now. Please try again.";

export type HandleEmailStudioViewDeps = {
  sender?: StudioViewEmailSender;
  composeCard?: (
    configuration: DiamondStudioConfiguration,
    variant: "card",
  ) => Promise<StudioSnapshotResult>;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  persist?: (
    record: StudioViewEmailedRecord,
  ) => Promise<StudioPersistResult>;
  /** Injected Continuum store. Production uses Supabase when configured. */
  continuum?: ContinuumStore | null;
  createOperationId?: () => string;
};

export async function handleEmailStudioView(input: {
  rawBody: string;
  ip: string;
  deps?: HandleEmailStudioViewDeps;
}): Promise<HandleEmailStudioViewResult> {
  const env = input.deps?.env ?? process.env;

  const honeypot = readHoneypotFromJson(input.rawBody);
  if (honeypot) {
    console.info("[studio-email-honeypot]", { rejected: true });
    return {
      ok: true,
      accepted: false,
      message: "Sent. Check your inbox.",
    };
  }

  const validated = parseEmailViewJsonBody(input.rawBody);
  if (!validated.ok) {
    const status = validated.code === "payload_too_large" ? 413 : 400;
    return {
      ok: false,
      accepted: false,
      status,
      code: validated.code,
      message: validated.message,
    };
  }

  const rate = checkStudioEmailRateLimit(input.ip);
  if (!rate.allowed) {
    return {
      ok: false,
      accepted: false,
      status: 429,
      code: "rate_limited",
      message: STUDIO_EMAIL_RATE_LIMIT_ERROR,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  if (!isStudioViewEmailConfigured(env)) {
    recordStudioOperationalSignal({
      type: "visitor-email-sender-unavailable",
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      accepted: false,
      status: 503,
      code: "unconfigured",
      message: VISITOR_RETRY,
    };
  }

  const from = resolveStudioViewEmailFrom(env);
  if (!from) {
    return {
      ok: false,
      accepted: false,
      status: 503,
      code: "unconfigured",
      message: VISITOR_RETRY,
    };
  }

  const operationId = (input.deps?.createOperationId ?? randomUUID)();
  const continuum =
    input.deps && "continuum" in input.deps
      ? (input.deps.continuum ?? null)
      : tryCreateContinuumStore();

  const sharePath = configurationSharePath(validated.configuration);
  const rendered = renderStudioViewEmail({
    configuration: validated.configuration,
    sharePath,
    firstName: validated.firstName,
    env,
  });

  const compose = input.deps?.composeCard ?? composeStudioSnapshot;
  let card: StudioSnapshotResult;
  try {
    card = await compose(validated.configuration, "card");
  } catch {
    recordStudioOperationalSignal({
      type: "snapshot-generation-failure",
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      accepted: false,
      status: 500,
      code: "mail_failed",
      message: VISITOR_RETRY,
    };
  }

  const sender = input.deps?.sender ?? resendStudioViewEmailSender;
  let sent: Awaited<ReturnType<StudioViewEmailSender>>;
  try {
    sent = await sender({
      from,
      to: validated.email,
      subject: STUDIO_VIEW_EMAIL_SUBJECT,
      html: rendered.html,
      text: rendered.text,
      attachments: [
        {
          filename: snapshotDownloadFilename(validated.configuration, "card"),
          content: card.buffer,
          contentType: "image/jpeg",
          contentId: STUDIO_CARD_CONTENT_ID,
        },
      ],
    });
  } catch {
    sent = { ok: false, error: "send_failed" };
  } finally {
    releaseStudioSnapshotBuffer(card.buffer);
  }

  if (!sent.ok) {
    return {
      ok: false,
      accepted: false,
      status: 502,
      code: "mail_failed",
      message: VISITOR_RETRY,
    };
  }

  const now = input.deps?.now ?? (() => new Date());
  const timestamp = now().toISOString();
  const record: StudioViewEmailedRecord = {
    event: "studio_view_emailed",
    id: randomUUID(),
    timestamp,
    recipientEmail: validated.email,
    emailNormalized: validated.email,
    emailHash: studioViewEmailHash(validated.email),
    firstName: validated.firstName,
    configuration: validated.configuration,
    studioSharePath: sharePath,
    attribution: validated.attribution
      ? { ...validated.attribution, originating_tool: validated.attribution.originating_tool ?? "diamond-studio" }
      : { originating_tool: "diamond-studio" },
    status: "sent",
    marketingConsent: false,
    inquiryCreated: false,
  };

  const persist =
    input.deps?.persist ??
    ((row: StudioViewEmailedRecord) => persistStudioViewEmailed(row, { env }));
  let persistResult: StudioPersistResult;
  try {
    persistResult = await persist(record);
  } catch {
    persistResult = {
      ok: false,
      adapter: "none",
      durable: false,
      status: "failed",
      reason: "write_failed",
    };
  }

  if (persistResult.status === "failed") {
    console.error("[studio-view-emailed-persist]", {
      failed: true,
      durable: false,
      emailSent: true,
      operationId,
    });
    // Legacy in-process signal. Continuum exception is the durable path when
    // Continuum storage is available. A shared Postgres outage can lose both.
    recordStudioOperationalSignal({
      type: "identified-event-persistence-failed",
      timestamp,
      emailsSent: 1,
    });
    await recordIdentifiedPersistenceFailedBestEffort({
      store: continuum,
      operationId,
      nowIso: timestamp,
    });
  } else if (persistResult.status === "durable") {
    recordStudioOperationalSignal({
      type: "identified-event-persistence-healthy",
      timestamp,
    });
    await ingestStudioViewEmailedBestEffort({
      store: continuum,
      operationId,
      source: {
        identifiedRecordId: record.id,
        occurredAt: record.timestamp,
        sharePath: record.studioSharePath,
        configuration: mapStudioConfiguration(record.configuration),
      },
    });
  }

  return {
    ok: true,
    accepted: true,
    message: "Sent. Check your inbox.",
    record,
    persistence: {
      durable: persistResult.durable,
      status: persistResult.status,
      adapter: persistResult.adapter,
    },
  };
}
