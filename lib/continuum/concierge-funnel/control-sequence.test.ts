import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CONTROLLED_ACCEPTANCE_PAYLOAD } from "./controlled-acceptance";
import { runControlledAcceptanceSequence } from "./control-sequence";

function response(body: object, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return structuredClone(body);
    },
  };
}

const created = {
  ok: true,
  funnelStatus: "created",
  intakeId: "intake-1",
  personId: "person-1",
  jobId: "job-1",
  candidateId: "candidate-1",
  founderAction: {
    id: "action-1",
    sourceLabel: "Website Concierge",
    headline: "SYNTHETIC ACCEPTANCE — verify Concierge persistence",
    reviewStatus: "pending",
  },
  acknowledgement: {
    outboxId: "outbox-1",
    state: "ready",
    attemptCount: 0,
    providerMessageId: null,
    reconciliationRequired: false,
  },
  booking: {
    bookingId: "booking-1",
    state: "requested",
    offeredWindow: null,
    providerEventId: null,
  },
  deliveryMode: "preview-fake-not-dispatched",
};

const verification = {
  ok: true,
  identifiers: {
    intakeId: "intake-1",
    personId: "person-1",
    jobId: "job-1",
    candidateId: "candidate-1",
    outboxId: "outbox-1",
  },
  counts: { intakes: 1, people: 1, jobs: 1, candidates: 1, outbox: 1 },
  sourceLabel: "Website Concierge",
  founderReview: {
    status: "pending",
    title: "Synthetic Concierge acceptance",
    headline: "SYNTHETIC ACCEPTANCE — verify Concierge persistence",
    persistsAcrossReload: true,
    writesCanonicalProject: false,
  },
  syntheticClassification: {
    acceptanceFixture: true,
    websiteIntakeSynthetic: false,
    rule: "concierge-controlled-synthetic-acceptance",
    compatibilityNote: "compatibility",
  },
  acknowledgement: {
    state: "ready",
    attemptCount: 0,
    providerMessageId: null,
    reconciliationRequired: false,
  },
  booking: {
    bookingId: "booking-1",
    state: "requested",
    offeredWindow: null,
    providerEventId: null,
  },
  providerSafety: {
    hubspotContactId: null,
    hubspotDealId: null,
    hubspotStatus: "pending",
    outboundDeliveryAttempted: false,
  },
};

describe("founder-operated Concierge acceptance control", () => {
  it("submits once, replays identically, then verifies through the server read path", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await runControlledAcceptanceSequence(async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) return response(created);
      if (calls.length === 2) {
        return response({ ...created, funnelStatus: "duplicate" });
      }
      return response(verification);
    });

    assert.equal(result.complete, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[0]?.url, "/executive-dashboard/concierge/preview-acceptance");
    assert.equal(calls[1]?.url, calls[0]?.url);
    assert.equal(calls[0]?.init?.body, JSON.stringify(CONTROLLED_ACCEPTANCE_PAYLOAD));
    assert.equal(calls[1]?.init?.body, calls[0]?.init?.body);
    assert.equal(calls[2]?.url, "/executive-dashboard/concierge/preview-acceptance-control/verify");
  });

  it("stops before verification when a submission fails", async () => {
    let calls = 0;
    await assert.rejects(
      runControlledAcceptanceSequence(async () => {
        calls += 1;
        return calls === 1
          ? response(created)
          : response({ ok: false, error: "duplicate-check-failed" }, 503);
      }),
      /duplicate-check-failed/,
    );
    assert.equal(calls, 2);
  });

  it("does not execute the acceptance sequence on page load or refresh", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "app/executive-dashboard/concierge/preview-acceptance-control/acceptance-control.tsx",
      ),
      "utf8",
    );

    assert.match(source, /onClick=\{run\}/);
    assert.match(source, /Run Synthetic Concierge Acceptance/);
    assert.doesNotMatch(source, /useEffect/);
  });
});
