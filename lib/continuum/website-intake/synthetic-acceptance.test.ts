import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  runSyntheticWebsiteIntakeAcceptance,
  type WebsiteIntakeIngest,
} from "./synthetic-acceptance";
import type { WebsiteInquiry, WebsiteIntakeResult } from "./types";

const SUBMISSION_ID = "continuum_acceptance_20261003";
const INTAKE_ID = "825ab1b3-7cdc-43eb-8972-05035b7ab1ac";

function isolatedResult(
  status: "created" | "already-present",
  intakeId = INTAKE_ID,
): WebsiteIntakeResult {
  return {
    ok: true,
    status,
    intakeId,
    identityStatus: "synthetic",
    personId: null,
    jobId: null,
    hubspotStatus: "skipped",
  };
}

describe("synthetic Website Intake acceptance", () => {
  it("preserves synthetic isolation and proves an exact idempotent replay", async () => {
    const inquiries: WebsiteInquiry[] = [];
    const ingest: WebsiteIntakeIngest = async (inquiry) => {
      inquiries.push(inquiry);
      return isolatedResult(inquiries.length === 1 ? "created" : "already-present");
    };

    const result = await runSyntheticWebsiteIntakeAcceptance({
      submissionId: SUBMISSION_ID,
      ingest,
    });

    assert.deepEqual(result, {
      ok: true,
      intakeId: INTAKE_ID,
      initialStatus: "created",
      replayStatus: "already-present",
      isolated: true,
    });
    assert.equal(inquiries.length, 2);
    assert.deepEqual(inquiries[1], inquiries[0]);
    assert.equal(inquiries[0]?.synthetic, true);
    assert.equal(inquiries[0]?.acknowledgementExpected, false);
    assert.equal(inquiries[0]?.phone, "");
    assert.match(inquiries[0]?.email ?? "", /@healthcheck\.invalid$/);
  });

  it("fails closed on identity, Job, HubSpot, or replay leakage", async () => {
    for (const leaked of [
      { ...isolatedResult("created"), identityStatus: "new" as const },
      { ...isolatedResult("created"), personId: "person-1" },
      { ...isolatedResult("created"), jobId: "job-1" },
      { ...isolatedResult("created"), hubspotStatus: "pending" as const },
    ]) {
      const ingest = async () => leaked;
      assert.deepEqual(
        await runSyntheticWebsiteIntakeAcceptance({ submissionId: SUBMISSION_ID, ingest }),
        { ok: false, reason: "isolation-failed" },
      );
    }

    const duplicate: WebsiteIntakeIngest = async () => isolatedResult("created");
    assert.deepEqual(
      await runSyntheticWebsiteIntakeAcceptance({
        submissionId: SUBMISSION_ID,
        ingest: duplicate,
      }),
      { ok: false, reason: "idempotency-failed" },
    );
  });

  it("keeps the acceptance endpoint secret-protected and detached from public inquiry effects", () => {
    const root = process.cwd();
    const route = readFileSync(
      resolve(root, "app/api/cron/continuum-intake-health/synthetic-acceptance/route.ts"),
      "utf8",
    );
    const publicRoute = readFileSync(resolve(root, "app/api/concierge/route.ts"), "utf8");

    assert.match(route, /export async function POST/);
    assert.match(route, /verifyCronRequest/);
    assert.match(route, /runSyntheticWebsiteIntakeAcceptance/);
    assert.doesNotMatch(route, /HubSpot|setupConciergeSlaAfterDeal|sendEmail|resend/i);
    assert.match(publicRoute, /synthetic: false/);
    assert.doesNotMatch(publicRoute, /runSyntheticWebsiteIntakeAcceptance/);
  });
});
