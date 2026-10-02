import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/intelligence/cron-auth";
import {
  createProductionLedgerAutomationStore,
  executeScheduledLedgerRun,
} from "@/lib/ledger-automation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await executeScheduledLedgerRun({
      runType: "TUESDAY_FULL",
      store: createProductionLedgerAutomationStore(),
    });
    console.info("ledger-automation", {
      runKey: result.run.runKey,
      state: result.run.state,
      classification: result.run.classification,
      created: result.created,
    });
    return NextResponse.json(result, { status: result.run.state === "FAILED" ? 503 : 200 });
  } catch (error) {
    console.error("ledger-automation Tuesday failed safely", error);
    return NextResponse.json({ error: "Ledger automation failed safely; nothing was published." }, { status: 500 });
  }
}
