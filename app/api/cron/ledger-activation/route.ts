import { NextResponse } from "next/server";
import {
  createLiveLedgerAdapter,
  createProductionLedgerAutomationStore,
  createProductionLedgerPublicationStore,
  executeScheduledLedgerRun,
  ledgerScheduledDate,
} from "@/lib/ledger-automation";
import { verifyLedgerActivationRequest } from "@/lib/ledger-automation/activation-auth";
import { runLedgerProviderSmoke } from "@/lib/ledger-automation/provider-smoke";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type ActivationRequest = {
  action?: unknown;
  expectedLocalDate?: unknown;
};

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "production" || !verifyLedgerActivationRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ActivationRequest;
  try {
    body = await request.json() as ActivationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "provider-smoke") {
    const results = await runLedgerProviderSmoke();
    return NextResponse.json({
      ok: results.every((result) => result.outcome === "SUCCESS"),
      checkedAt: new Date().toISOString(),
      results,
    });
  }

  if (body.action !== "tuesday-full" || body.expectedLocalDate !== "2026-10-20") {
    return NextResponse.json({ error: "Unsupported activation action." }, { status: 400 });
  }

  const now = new Date();
  const localDate = ledgerScheduledDate(now);
  if (localDate !== body.expectedLocalDate) {
    return NextResponse.json({ error: "The controlled reconciliation date is not active.", localDate }, { status: 409 });
  }

  const result = await executeScheduledLedgerRun({
    runType: "TUESDAY_FULL",
    now,
    store: createProductionLedgerAutomationStore(),
    publicationStore: createProductionLedgerPublicationStore(),
    adapter: createLiveLedgerAdapter(),
  });
  const run = result.run;
  return NextResponse.json({
    created: result.created,
    runKey: run.runKey,
    state: run.state,
    classification: run.classification,
    publicationOccurred: run.publicationOccurred,
    publicationId: run.publicationId,
    publicationDate: run.publicationDate,
    proposedPublication: run.proposedPublication,
    canonicalPublication: run.classification === "APPROVAL_REQUIRED" ? run.canonicalPublication : null,
    sourceHealth: run.evidencePacket.sourceChecks.map((check) => ({
      provider: check.metadata.provider ?? null,
      sourceId: check.sourceId,
      status: check.status,
      failureCode: check.failure?.code ?? null,
      observationDate: check.observationTimestamp,
      freshness: check.freshness,
    })),
  }, { status: run.state === "PUBLICATION_FAILED" ? 503 : 200 });
}
