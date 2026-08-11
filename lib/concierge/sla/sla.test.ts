/**
 * P0-5 Concierge SLA focused tests — memory store + fake HubSpot/Resend.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createFakeEmailSender } from "@/lib/agent-os/cadence-delivery/send-email";
import { runChiefOfStaff } from "@/lib/agent-os/executives/chief-of-staff";
import { emptyBusinessIntelligenceOutput } from "@/lib/agent-os/bi/empty";
import type { hubspotFetchJson } from "@/lib/concierge/hubspot-client";
import {
  assertConciergeSlaSchemaHasNoPii,
  CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
  conciergeSlaTaskSubject,
  createMemoryConciergeSlaStore,
  dueAtFromSubmittedAt,
  ensureConciergeSlaTask,
  findExistingConciergeSlaTask,
  injectConciergeSlaOverdueIntoSurfacePool,
  isConciergeSlaEnabled,
  isDueSoonWindow,
  isOverdueWindow,
  resolveConciergeAlertEmailConfig,
  runConciergeSlaWatchdog,
  sendConciergeSlaAlert,
  setupConciergeSlaAfterDeal,
} from "./index";
import {
  HUBSPOT_TASK_TO_CONTACT_ASSOCIATION,
  HUBSPOT_TASK_TO_DEAL_ASSOCIATION,
} from "./types";
import { ConciergeAlertConfigError } from "./email-config";

const SUBMITTED = "2026-08-10T12:00:00.000Z";
type FetchJson = typeof hubspotFetchJson;

const ORIGINAL_ENV = { ...process.env };

function enableSlaEnv() {
  process.env.CONCIERGE_SLA_ENABLED = "true";
  process.env.CONCIERGE_SLA_TEST_MEMORY = "1";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CONCIERGE_ALERT_EMAIL_FROM = "concierge-alerts@hourglass.test";
  process.env.CONCIERGE_ALERT_EMAIL_TO = "founder-alerts@hourglass.test";
  delete process.env.AGENT_OS_EMAIL_FROM;
  delete process.env.AGENT_OS_EMAIL_TO;
  delete process.env.INTELLIGENCE_EMAIL_FROM;
  delete process.env.INTELLIGENCE_EMAIL_TO;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  enableSlaEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});


describe("Concierge SLA ledger", () => {
  it("upserts one SLA per deal and rejects PII column names", async () => {
    const store = createMemoryConciergeSlaStore();
    const dueAt = dueAtFromSubmittedAt(SUBMITTED);
    const a = await store.upsertByDealId({
      dealId: "deal-1",
      contactId: "contact-1",
      submissionId: "sub-1",
      submittedAt: SUBMITTED,
      dueAt,
    });
    const b = await store.upsertByDealId({
      dealId: "deal-1",
      contactId: "contact-1",
      submissionId: "sub-1",
      submittedAt: SUBMITTED,
      dueAt,
      taskId: "task-1",
    });
    assert.equal(store._rows.size, 1);
    assert.equal(a.dealId, b.dealId);
    assert.equal(b.taskId, "task-1");
    assert.equal("email" in a, false);
    assert.equal("phone" in a, false);
    assert.throws(() => assertConciergeSlaSchemaHasNoPii(["deal_id", "email"]));
    assert.doesNotThrow(() =>
      assertConciergeSlaSchemaHasNoPii([
        "deal_id",
        "contact_id",
        "task_id",
        "submission_id",
        "status",
      ]),
    );
  });

  it("submission retry returns existing row when submission_id matches", async () => {
    const store = createMemoryConciergeSlaStore();
    const dueAt = dueAtFromSubmittedAt(SUBMITTED);
    await store.upsertByDealId({
      dealId: "deal-a",
      submissionId: "sub-same",
      submittedAt: SUBMITTED,
      dueAt,
    });
    const again = await store.upsertByDealId({
      dealId: "deal-b",
      submissionId: "sub-same",
      submittedAt: SUBMITTED,
      dueAt,
    });
    assert.equal(again.dealId, "deal-a");
    assert.equal(store._rows.size, 1);
  });
});

describe("Concierge SLA HubSpot task adapter", () => {
  it("creates HIGH / NOT_STARTED task with +24h due and associations", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchJson = (async (path: string, init: RequestInit) => {
      const method = (init.method || "GET").toUpperCase();
      const body = typeof init.body === "string" ? init.body : undefined;
      calls.push({ url: path, method, body });
      if (path.includes("/associations/tasks") && method === "GET") {
        return { results: [] };
      }
      if (path === "/crm/v3/objects/tasks" && method === "POST") {
        return { id: "task-new" };
      }
      return {};
    }) as FetchJson;

    const dueAt = dueAtFromSubmittedAt(SUBMITTED);
    const result = await ensureConciergeSlaTask({
      dealId: "deal-99",
      contactId: "contact-99",
      dueAtIso: dueAt,
      token: "pat-test",
      fetchJson,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.taskId, "task-new");
    assert.equal(result.created, true);

    const create = calls.find(
      (c) => c.url === "/crm/v3/objects/tasks" && c.method === "POST",
    );
    assert.ok(create?.body);
    const parsed = JSON.parse(create!.body!) as {
      properties: Record<string, string>;
      associations: Array<{
        to: { id: string };
        types: Array<{ associationTypeId: number }>;
      }>;
    };
    assert.equal(parsed.properties.hs_task_priority, "HIGH");
    assert.equal(parsed.properties.hs_task_status, "NOT_STARTED");
    assert.equal(parsed.properties.hs_timestamp, dueAt);
    assert.equal(
      parsed.properties.hs_task_subject,
      conciergeSlaTaskSubject("deal-99"),
    );
    assert.equal(parsed.properties.hubspot_owner_id, undefined);
    const typeIds = parsed.associations.flatMap((a) =>
      a.types.map((t) => t.associationTypeId),
    );
    assert.ok(typeIds.includes(HUBSPOT_TASK_TO_CONTACT_ASSOCIATION));
    assert.ok(typeIds.includes(HUBSPOT_TASK_TO_DEAL_ASSOCIATION));
    assert.equal(HUBSPOT_TASK_TO_CONTACT_ASSOCIATION, 204);
    assert.equal(HUBSPOT_TASK_TO_DEAL_ASSOCIATION, 216);
  });

  it("assigns owner only when validation succeeds", async () => {
    const fetchJson = (async (path: string, init: RequestInit) => {
      const method = (init.method || "GET").toUpperCase();
      if (path.includes("/associations/tasks")) return { results: [] };
      if (path.includes("/crm/v3/owners/owner-ok") && method === "GET") {
        return { id: "owner-ok" };
      }
      if (path === "/crm/v3/objects/tasks" && method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          properties: Record<string, string>;
        };
        assert.equal(body.properties.hubspot_owner_id, "owner-ok");
        return { id: "task-owned" };
      }
      return {};
    }) as FetchJson;

    const result = await ensureConciergeSlaTask({
      dealId: "deal-o",
      contactId: "contact-o",
      dueAtIso: dueAtFromSubmittedAt(SUBMITTED),
      token: "pat-test",
      ownerId: "owner-ok",
      fetchJson,
    });
    assert.equal(result.ok, true);
  });

  it("timeout recovery reuses existing associated Concierge SLA task", async () => {
    let postAttempts = 0;
    const fetchJson = (async (path: string, init: RequestInit) => {
      const method = (init.method || "GET").toUpperCase();
      if (path.includes("/associations/tasks") && method === "GET") {
        // First look: empty; after failed create: task present.
        if (postAttempts === 0) return { results: [] };
        return { results: [{ id: "task-recovered" }] };
      }
      if (path.includes("/tasks/task-recovered") && method === "GET") {
        return {
          id: "task-recovered",
          properties: {
            hs_task_subject: conciergeSlaTaskSubject("deal-t"),
            hs_task_status: "NOT_STARTED",
          },
        };
      }
      if (path === "/crm/v3/objects/tasks" && method === "POST") {
        postAttempts += 1;
        throw new Error("hubspot_timeout");
      }
      return {};
    }) as FetchJson;

    const result = await ensureConciergeSlaTask({
      dealId: "deal-t",
      contactId: "contact-t",
      dueAtIso: dueAtFromSubmittedAt(SUBMITTED),
      token: "pat-test",
      fetchJson,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.taskId, "task-recovered");
    assert.equal(result.recovered, true);
    assert.equal(postAttempts, 1);

    const existing = await findExistingConciergeSlaTask({
      dealId: "deal-t",
      token: "pat-test",
      fetchJson,
    });
    assert.equal(existing?.taskId, "task-recovered");
  });
});

describe("Concierge SLA setup path", () => {
  beforeEach(() => {
  });

  it("creates ledger + task and sends immediate alert once", async () => {
    const store = createMemoryConciergeSlaStore();
    const sender = createFakeEmailSender({ honorIdempotencyKey: true });
    const fetchJson = (async (path: string, init: RequestInit) => {
      const method = (init.method || "GET").toUpperCase();
      if (path.includes("/associations/tasks")) return { results: [] };
      if (path === "/crm/v3/objects/tasks" && method === "POST") {
        return { id: "task-setup" };
      }
      return {};
    }) as FetchJson;

    const first = await setupConciergeSlaAfterDeal({
      dealId: "deal-s",
      contactId: "contact-s",
      submissionId: "sub-s",
      submittedAt: SUBMITTED,
      token: "pat-test",
      store,
      emailSender: sender,
      fetchJson,
      enabled: true,
    });
    assert.equal(first.ok, true);
    assert.equal(first.taskId, "task-setup");
    assert.equal(first.immediateAlertSent, true);
    assert.equal(sender.calls.length, 1);
    assert.match(sender.calls[0]!.subject, /New Concierge inquiry received/);
    assert.doesNotMatch(JSON.stringify(sender.calls), /@/);
    assert.doesNotMatch(JSON.stringify(store._rows.get("deal-s")), /email|phone/i);

    const second = await setupConciergeSlaAfterDeal({
      dealId: "deal-s",
      contactId: "contact-s",
      submissionId: "sub-s",
      submittedAt: SUBMITTED,
      token: "pat-test",
      store,
      emailSender: sender,
      fetchJson,
      enabled: true,
    });
    assert.equal(second.immediateAlertSent, false);
    assert.equal(sender.calls.length, 1);
  });

  it("task failure still returns setupFailed without throwing; customer path safe", async () => {
    const store = createMemoryConciergeSlaStore();
    const sender = createFakeEmailSender();
    const fetchJson = (async () => {
      throw new Error("hubspot_network_error");
    }) as FetchJson;

    const result = await setupConciergeSlaAfterDeal({
      dealId: "deal-fail",
      contactId: "contact-fail",
      submissionId: "sub-fail",
      submittedAt: SUBMITTED,
      token: "pat-test",
      store,
      emailSender: sender,
      fetchJson,
      enabled: true,
    });
    assert.equal(result.setupFailed, true);
    assert.equal(result.failedComponent, "task");
    assert.ok(sender.calls.some((c) => /SETUP FAILURE/i.test(c.subject)));
  });

  it("ledger unavailable emits setup failure", async () => {
    const sender = createFakeEmailSender();
    const result = await setupConciergeSlaAfterDeal({
      dealId: "deal-noleger",
      contactId: "contact-x",
      submissionId: "sub-x",
      submittedAt: SUBMITTED,
      store: null,
      emailSender: sender,
      enabled: true,
    });
    assert.equal(result.setupFailed, true);
    assert.equal(result.failedComponent, "ledger");
  });
});

describe("Concierge SLA watchdog thresholds", () => {
  let store: ReturnType<typeof createMemoryConciergeSlaStore>;
  let sender: ReturnType<typeof createFakeEmailSender>;

  beforeEach(async () => {
    store = createMemoryConciergeSlaStore();
    sender = createFakeEmailSender();
    await store.upsertByDealId({
      dealId: "deal-w",
      contactId: "contact-w",
      taskId: "task-w",
      submissionId: "sub-w",
      submittedAt: SUBMITTED,
      dueAt: dueAtFromSubmittedAt(SUBMITTED),
    });
    await store.patch("deal-w", {
      immediateAlertedAt: SUBMITTED,
    });
  });

  afterEach(() => {
    // no-op
  });

  function hoursLater(h: number): string {
    return new Date(Date.parse(SUBMITTED) + h * 3600_000).toISOString();
  }

  const completedTaskFetch = (async (path: string) => {
    if (path.includes("/tasks/task-w")) {
      return {
        id: "task-w",
        properties: { hs_task_status: "COMPLETED" },
      };
    }
    return {};
  }) as typeof import("@/lib/concierge/hubspot-client").hubspotFetchJson;

  const openTaskFetch = (async (path: string) => {
    if (path.includes("/tasks/task-w")) {
      return {
        id: "task-w",
        properties: { hs_task_status: "NOT_STARTED" },
      };
    }
    if (path.includes("/associations/tasks")) return { results: [{ id: "task-w" }] };
    return {};
  }) as typeof import("@/lib/concierge/hubspot-client").hubspotFetchJson;

  it("time window helpers", () => {
    assert.equal(isDueSoonWindow(SUBMITTED, hoursLater(19.99)), false);
    assert.equal(isDueSoonWindow(SUBMITTED, hoursLater(20)), true);
    assert.equal(isOverdueWindow(SUBMITTED, hoursLater(23.99)), false);
    assert.equal(isOverdueWindow(SUBMITTED, hoursLater(24)), true);
  });

  it("<20h → no alert", async () => {
    const result = await runConciergeSlaWatchdog({
      nowIso: hoursLater(19),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(result.dueSoonSent, 0);
    assert.equal(result.overdueSent, 0);
    assert.equal(sender.calls.length, 0);
  });

  it(">=20h due-soon once; repeat does not duplicate", async () => {
    const a = await runConciergeSlaWatchdog({
      nowIso: hoursLater(20),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(a.dueSoonSent, 1);
    assert.equal(sender.calls.length, 1);
    assert.match(sender.calls[0]!.subject, /due soon/i);

    const b = await runConciergeSlaWatchdog({
      nowIso: hoursLater(21),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(b.dueSoonSent, 0);
    assert.equal(sender.calls.length, 1);
  });

  it("23h59 no overdue; 24h overdue once; repeat no duplicate", async () => {
    await store.patch("deal-w", { dueSoonAlertedAt: hoursLater(20) });
    const almost = await runConciergeSlaWatchdog({
      nowIso: hoursLater(23.99),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(almost.overdueSent, 0);

    const overdue = await runConciergeSlaWatchdog({
      nowIso: hoursLater(24),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(overdue.overdueSent, 1);
    assert.match(sender.calls[0]!.subject, /OVERDUE CONCIERGE LEAD/);

    const again = await runConciergeSlaWatchdog({
      nowIso: hoursLater(25),
      store,
      emailSender: sender,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(again.overdueSent, 0);
    assert.equal(sender.calls.length, 1);
  });

  it("completed @19h → neither threshold", async () => {
    const result = await runConciergeSlaWatchdog({
      nowIso: hoursLater(19),
      store,
      emailSender: sender,
      fetchJson: completedTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(result.completed, 1);
    assert.equal(result.dueSoonSent, 0);
    assert.equal(sender.calls.length, 0);
    const row = await store.getByDealId("deal-w");
    assert.equal(row?.status, "completed");
  });

  it("completed @25h → no further alerts", async () => {
    await store.patch("deal-w", {
      overdueAlertedAt: hoursLater(24),
    });
    const result = await runConciergeSlaWatchdog({
      nowIso: hoursLater(25),
      store,
      emailSender: sender,
      fetchJson: completedTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(result.completed, 1);
    assert.equal(sender.calls.length, 0);
  });

  it("Resend failure leaves threshold unstamped; retry stamps", async () => {
    let fail = true;
    const flaky = createFakeEmailSender();
    const original = flaky as ReturnType<typeof createFakeEmailSender>;
    const wrapped: typeof original = Object.assign(
      async (input: Parameters<typeof original>[0]) => {
        if (fail) {
          return { ok: false as const, uncertain: false, error: "resend_down" };
        }
        return original(input);
      },
      { calls: original.calls },
    );

    const a = await runConciergeSlaWatchdog({
      nowIso: hoursLater(20),
      store,
      emailSender: wrapped,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(a.dueSoonSent, 0);
    assert.equal((await store.getByDealId("deal-w"))?.dueSoonAlertedAt, null);

    fail = false;
    const b = await runConciergeSlaWatchdog({
      nowIso: hoursLater(20.5),
      store,
      emailSender: wrapped,
      fetchJson: openTaskFetch,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(b.dueSoonSent, 1);
    assert.ok((await store.getByDealId("deal-w"))?.dueSoonAlertedAt);
  });

  it("missing task recovers without completing", async () => {
    let created = 0;
    const fetchJson = (async (path: string, init: RequestInit) => {
      const method = (init.method || "GET").toUpperCase();
      if (path.includes("/tasks/task-w") && method === "GET") {
        return null;
      }
      if (path.includes("/associations/tasks") && method === "GET") {
        return { results: [] };
      }
      if (path === "/crm/v3/objects/tasks" && method === "POST") {
        created += 1;
        return { id: "task-recreated" };
      }
      return {};
    }) as FetchJson;

    const result = await runConciergeSlaWatchdog({
      nowIso: hoursLater(5),
      store,
      emailSender: sender,
      fetchJson,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(result.recoveredTasks, 1);
    assert.equal(created, 1);
    assert.equal((await store.getByDealId("deal-w"))?.taskId, "task-recreated");
    assert.equal((await store.getByDealId("deal-w"))?.status, "open");
  });

  it("HubSpot unavailable leaves SLA open", async () => {
    const fetchJson = (async () => {
      throw new Error("hubspot_network_error");
    }) as FetchJson;

    const result = await runConciergeSlaWatchdog({
      nowIso: hoursLater(5),
      store,
      emailSender: sender,
      fetchJson,
      token: "pat-test",
      enabled: true,
    });
    assert.equal((await store.getByDealId("deal-w"))?.status, "open");
    assert.equal((await store.getByDealId("deal-w"))?.completedAt, null);
    assert.equal(result.completed, 0);
    assert.equal(result.overdueSent, 0);
  });
});

describe("Concierge SLA Chief of Staff integration", () => {
  it("live overdue outranks normal work and bypasses terminal eligibility gate", () => {
    const bi = emptyBusinessIntelligenceOutput("fixture");
    const seoish = {
      recommendationId: "search:seo-polish",
      originatingExecutive: "search-strategy" as const,
      title: "SEO polish",
      plainLanguageExplanation: "Polish meta titles",
      whyItMattersNow: "SEO",
      proposedAction: "Edit titles",
      expectedUpside: "Rankings",
      effortEstimate: "low" as const,
      urgency: "medium" as const,
      reversibility: "easily-reversed" as const,
      confidence: 0.7,
      evidence: [] as never[],
      assumptions: [],
      risks: [],
      dependencies: [],
      approvalRequired: false,
      suggestedOwner: "Founder",
      status: "proposed" as const,
      agendaBucket: "schedule-next" as const,
      rankingFactors: {
        expectedBusinessImpact: 5,
        confidence: 0.7,
        urgency: 4,
        effort: 3,
        reversibility: 8,
        strategicAlignment: 5,
        dependencyReadiness: 1,
        dataQuality: 0.8,
      },
      priorityScore: 40,
    };

    const cos = runChiefOfStaff({
      bi: {
        ...bi,
        recommendations: [seoish],
      },
      reportingPeriod: { start: "2026-08-01", end: "2026-08-10" },
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      // Simulate P0-3 gate that would otherwise hide fresh IDs.
      founderSurfaceEligibleIds: [],
      conciergeSlaOverdueCount: 1,
    });

    assert.ok(
      cos.recommendations.some(
        (r) => r.recommendationId === CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
      ),
    );
    assert.match(cos.brief.markdown, /Overdue Concierge first-contact SLA/i);
    assert.match(cos.brief.markdown, /24 hours/i);
    assert.doesNotMatch(cos.brief.markdown, /phone|555-/i);
    const overdueRec = cos.recommendations.find(
      (r) => r.recommendationId === CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
    );
    assert.ok(overdueRec);
    assert.match(overdueRec!.plainLanguageExplanation, /Immediate attention/i);
    assert.ok(
      (overdueRec?.priorityScore ?? 0) >
        (cos.recommendations.find((r) => r.recommendationId === "search:seo-polish")
          ?.priorityScore ?? 0),
    );

    const cleared = runChiefOfStaff({
      bi: { ...bi, recommendations: [seoish] },
      reportingPeriod: { start: "2026-08-01", end: "2026-08-10" },
      warnings: [],
      mode: "fixture",
      briefCadenceIntent: "daily",
      founderSurfaceEligibleIds: [seoish.recommendationId],
      conciergeSlaOverdueCount: 0,
    });
    assert.equal(
      cleared.recommendations.some(
        (r) => r.recommendationId === CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
      ),
      false,
    );
  });

  it("inject helper places overdue first", () => {
    const injected = injectConciergeSlaOverdueIntoSurfacePool({
      recommendations: [],
      surfacePool: [],
      overdueCount: 2,
    });
    assert.equal(
      injected.surfacePool[0]?.recommendationId,
      CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID,
    );
    assert.match(
      injected.surfacePool[0]!.plainLanguageExplanation,
      /2 Concierge inquiries/,
    );
  });
});

describe("Concierge SLA privacy", () => {
  it("alert subjects and ledger fixtures contain no email/phone/message", async () => {
    const store = createMemoryConciergeSlaStore();
    const sender = createFakeEmailSender();
    const fetchJson = (async (path: string, init: RequestInit) => {
      if (String(path).includes("/associations/tasks")) return { results: [] };
      if (String(path).endsWith("/tasks") && (init.method || "GET") === "POST") {
        return { id: "task-p" };
      }
      return {};
    }) as FetchJson;

    await setupConciergeSlaAfterDeal({
      dealId: "deal-p",
      contactId: "contact-p",
      submissionId: "sub-p",
      submittedAt: SUBMITTED,
      token: "pat-test",
      store,
      emailSender: sender,
      fetchJson,
      enabled: true,
    });

    const blob = JSON.stringify({
      row: store._rows.get("deal-p"),
      calls: sender.calls,
    });
    assert.doesNotMatch(blob, /alex\.example|555-|inspiration|project notes/i);
    // Fake sender records alias only — ensure operational subjects.
    assert.ok(sender.calls[0]?.subject);
  });
});

describe("Concierge SLA enable gate", () => {
  it("isConciergeSlaEnabled requires exact true", () => {
    assert.equal(isConciergeSlaEnabled({ CONCIERGE_SLA_ENABLED: "true" }), true);
    assert.equal(isConciergeSlaEnabled({ CONCIERGE_SLA_ENABLED: "TRUE" }), false);
    assert.equal(isConciergeSlaEnabled({ CONCIERGE_SLA_ENABLED: "1" }), false);
    assert.equal(isConciergeSlaEnabled({}), false);
  });

  it("disabled setup skips ledger, HubSpot tasks, and alerts", async () => {
    const store = createMemoryConciergeSlaStore();
    const sender = createFakeEmailSender();
    let fetchCalls = 0;
    const fetchJson = (async () => {
      fetchCalls += 1;
      return {};
    }) as FetchJson;
    const result = await setupConciergeSlaAfterDeal({
      dealId: "deal-off",
      contactId: "contact-off",
      submissionId: "sub-off",
      submittedAt: SUBMITTED,
      token: "pat-test",
      store,
      emailSender: sender,
      fetchJson,
      enabled: false,
    });
    assert.equal(result.skipped, true);
    assert.equal(result.ok, true);
    assert.equal(store._rows.size, 0);
    assert.equal(fetchCalls, 0);
    assert.equal(sender.calls.length, 0);
  });

  it("disabled watchdog returns explicit no-op", async () => {
    const store = createMemoryConciergeSlaStore();
    const sender = createFakeEmailSender();
    const result = await runConciergeSlaWatchdog({
      nowIso: "2026-08-12T12:00:00.000Z",
      store,
      emailSender: sender,
      token: "pat-test",
      enabled: false,
    });
    assert.deepEqual(result, {
      ok: true,
      enabled: false,
      checked: 0,
      completed: 0,
      dueSoonSent: 0,
      overdueSent: 0,
      recoveredTasks: 0,
      errors: 0,
      alertsSent: 0,
    });
    assert.equal(sender.calls.length, 0);
  });
});

describe("Concierge SLA alert recipients", () => {
  it("A. dedicated Concierge alert env is preferred", () => {
    const cfg = resolveConciergeAlertEmailConfig({
      RESEND_API_KEY: "re_test",
      CONCIERGE_ALERT_EMAIL_FROM: "a@hourglass.test",
      CONCIERGE_ALERT_EMAIL_TO: "b@hourglass.test",
      AGENT_OS_EMAIL_FROM: "c@hourglass.test",
      AGENT_OS_EMAIL_TO: "d@hourglass.test",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.alertConfigSource, "concierge-alert");
    assert.equal(cfg.from, "a@hourglass.test");
    assert.equal(cfg.to, "b@hourglass.test");
  });

  it("B. Agent OS pair is used when Concierge pair absent", () => {
    const cfg = resolveConciergeAlertEmailConfig({
      RESEND_API_KEY: "re_test",
      AGENT_OS_EMAIL_FROM: "c@hourglass.test",
      AGENT_OS_EMAIL_TO: "d@hourglass.test",
    } as NodeJS.ProcessEnv);
    assert.equal(cfg.alertConfigSource, "agent-os-fallback");
    assert.equal(cfg.from, "c@hourglass.test");
    assert.equal(cfg.to, "d@hourglass.test");
  });

  it("C. missing recipient fails loud and does not stamp alerted_at", async () => {
    const store = createMemoryConciergeSlaStore();
    assert.throws(
      () => resolveConciergeAlertEmailConfig({} as NodeJS.ProcessEnv),
      ConciergeAlertConfigError,
    );

    await store.upsertByDealId({
      dealId: "deal-mail",
      contactId: "contact-mail",
      taskId: "task-mail",
      submissionId: "sub-mail",
      submittedAt: SUBMITTED,
      dueAt: dueAtFromSubmittedAt(SUBMITTED),
    });

    const alert = await sendConciergeSlaAlert(
      {
        kind: "due_soon",
        dealId: "deal-mail",
        submittedAt: SUBMITTED,
        dueAt: dueAtFromSubmittedAt(SUBMITTED),
      },
      { env: { RESEND_API_KEY: "" } as NodeJS.ProcessEnv },
    );
    assert.equal(alert.ok, false);

    delete process.env.CONCIERGE_ALERT_EMAIL_FROM;
    delete process.env.CONCIERGE_ALERT_EMAIL_TO;
    delete process.env.AGENT_OS_EMAIL_FROM;
    delete process.env.AGENT_OS_EMAIL_TO;
    delete process.env.INTELLIGENCE_EMAIL_FROM;
    delete process.env.INTELLIGENCE_EMAIL_TO;
    delete process.env.RESEND_API_KEY;

    const result = await runConciergeSlaWatchdog({
      nowIso: new Date(Date.parse(SUBMITTED) + 20 * 3600_000).toISOString(),
      store,
      fetchJson: (async (path: string) => {
        if (String(path).includes("/tasks/task-mail")) {
          return {
            id: "task-mail",
            properties: { hs_task_status: "NOT_STARTED" },
          };
        }
        return {};
      }) as FetchJson,
      token: "pat-test",
      enabled: true,
    });
    assert.equal(result.dueSoonSent, 0);
    assert.equal((await store.getByDealId("deal-mail"))?.dueSoonAlertedAt, null);
  });
});
