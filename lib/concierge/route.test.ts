import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "@/app/api/concierge/route";
import { resetConciergeRateLimits } from "./rate-limit";
import {
  getDefaultConciergeSlaStore,
  resetConciergeSlaTestStore,
} from "./sla/ledger";
import { createMemoryConciergeSlaStore } from "./sla/memory-store";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function buildFormRequest(
  fields: Record<string, string>,
  init?: { ip?: string; contentType?: "multipart" | "json"; jsonBody?: string },
): Request {
  if (init?.contentType === "json") {
    return new Request("https://example.com/api/concierge", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(init.ip ? { "x-forwarded-for": init.ip } : {}),
      },
      body: init.jsonBody ?? "{}",
    });
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return new Request("https://example.com/api/concierge", {
    method: "POST",
    headers: init?.ip ? { "x-forwarded-for": init.ip } : undefined,
    body: form,
  });
}

const validFields = {
  fullName: "Alex Example",
  email: "alex.example.concierge@example.com",
  phone: "",
  preferredContactMethod: "email",
  projectType: "Engagement Ring",
  shapeInterest: "Oval",
  designDirection: "Quiet Elegance",
  ringPresence: "Balanced",
  timeline: "Flexible",
  budgetRange: "Prefer to Discuss",
  inspirationNotes: "Mocked test inquiry",
  submissionId: "",
  company_website: "",
};

function mockSuccessfulHubSpot() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/crm/v3/objects/contacts/") && method === "PATCH") {
      return new Response("not found", { status: 404 });
    }
    if (url.endsWith("/crm/v3/objects/contacts") && method === "POST") {
      return new Response(JSON.stringify({ id: "contact-1" }), { status: 201 });
    }
    if (url.endsWith("/crm/v3/objects/deals") && method === "POST") {
      return new Response(JSON.stringify({ id: "deal-1" }), { status: 201 });
    }
    if (url.includes("/associations/deals/") && method === "PUT") {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/crm/v3/objects/notes") && method === "POST") {
      return new Response(JSON.stringify({ id: "note-1" }), { status: 201 });
    }
    // P0-5 Concierge SLA task paths
    if (url.includes("/associations/tasks") && method === "GET") {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }
    if (url.includes("/crm/v3/objects/tasks/") && method === "GET") {
      return new Response(null, { status: 404 });
    }
    if (url.endsWith("/crm/v3/objects/tasks") && method === "POST") {
      return new Response(JSON.stringify({ id: "task-1" }), { status: 201 });
    }
    if (url.includes("/crm/v3/owners/") && method === "GET") {
      return new Response(JSON.stringify({ id: "owner-1" }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: `unmocked ${method} ${url}` }), {
      status: 500,
    });
  }) as typeof fetch;
}

describe("POST /api/concierge", () => {
  beforeEach(() => {
    resetConciergeRateLimits();
    resetConciergeSlaTestStore();
    process.env = { ...ORIGINAL_ENV };
    process.env.HUBSPOT_ACCESS_TOKEN = "pat-test-access-token";
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = "";
    process.env.HUBSPOT_DEAL_PIPELINE_ID = "default";
    process.env.HUBSPOT_DEAL_STAGE_ID_NEW_INQUIRY = "stage-new";
    process.env.CONCIERGE_RATE_LIMIT_DISABLED = "1";
    process.env.CONCIERGE_SLA_TEST_MEMORY = "1";
    process.env.NODE_ENV = "test";
    // Default: SLA gate OFF — mirrors production ship-safe posture.
    delete process.env.CONCIERGE_SLA_ENABLED;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = ORIGINAL_FETCH;
    resetConciergeRateLimits();
    resetConciergeSlaTestStore();
  });

  it("accepts a successful HubSpot submission", async () => {
    mockSuccessfulHubSpot();
    const submissionId = crypto.randomUUID();
    const response = await POST(
      buildFormRequest({ ...validFields, submissionId }, { ip: "203.0.113.10" }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.accepted, true);
    assert.equal(body.submissionId, submissionId);
    assert.doesNotMatch(JSON.stringify(body), /pat-test-access-token/);
    assert.doesNotMatch(JSON.stringify(body), /Bearer /);
  });

  it("returns 500 visitor error when HubSpot token is missing", async () => {
    delete process.env.HUBSPOT_ACCESS_TOKEN;
    delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    mockSuccessfulHubSpot();

    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId: crypto.randomUUID() },
        { ip: "203.0.113.11" },
      ),
    );
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.ok, false);
    assert.equal(body.accepted, false);
    assert.match(body.message, /couldn’t send your note/i);
    assert.doesNotMatch(JSON.stringify(body), /HUBSPOT_/);
    assert.doesNotMatch(JSON.stringify(body), /pat-/);
  });

  it("falls back to HUBSPOT_PRIVATE_APP_TOKEN when access token is empty", async () => {
    process.env.HUBSPOT_ACCESS_TOKEN = "";
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = "pat-private-fallback-token";
    let sawBearer = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (headers.get("Authorization")) {
        sawBearer = headers.get("Authorization") || "";
      }
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/contacts/") && method === "PATCH") {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/contacts") && method === "POST") {
        return new Response(JSON.stringify({ id: "c1" }), { status: 201 });
      }
      if (url.endsWith("/deals") && method === "POST") {
        return new Response(JSON.stringify({ id: "d1" }), { status: 201 });
      }
      if (url.includes("/associations/") && method === "PUT") {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/notes") && method === "POST") {
        return new Response(JSON.stringify({ id: "n1" }), { status: 201 });
      }
      return new Response("{}", { status: 500 });
    }) as typeof fetch;

    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId: crypto.randomUUID() },
        { ip: "203.0.113.12" },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.accepted, true);
    assert.equal(sawBearer, "Bearer pat-private-fallback-token");
    assert.doesNotMatch(JSON.stringify(body), /pat-private-fallback-token/);
  });

  it("returns visitor error on HubSpot authentication failure", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "Authentication credentials not found" }), {
        status: 401,
      })) as typeof fetch;

    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId: crypto.randomUUID() },
        { ip: "203.0.113.13" },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.ok, false);
    assert.match(body.message, /couldn’t send your note/i);
    assert.doesNotMatch(JSON.stringify(body), /Authentication credentials/);
    assert.doesNotMatch(JSON.stringify(body), /pat-test/);
  });

  it("returns visitor error on HubSpot API validation failure", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ message: "Property values were not valid: preferred_contact_method" }),
        { status: 400 },
      )) as typeof fetch;

    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId: crypto.randomUUID() },
        { ip: "203.0.113.14" },
      ),
    );
    const body = await response.json();
    // Retries strip preferred_contact_method; still failing both attempts → 500
    assert.equal(response.status, 500);
    assert.equal(body.accepted, false);
    assert.doesNotMatch(JSON.stringify(body), /preferred_contact_method/);
  });

  it("returns 400 for malformed client submission bodies", async () => {
    const response = await POST(
      buildFormRequest({}, { contentType: "json", jsonBody: "{not-json" }),
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.equal(body.accepted, false);
    assert.match(body.message, /check the form/i);
  });

  it("returns 400 for phone preference without a phone number", async () => {
    const response = await POST(
      buildFormRequest(
        {
          ...validFields,
          preferredContactMethod: "phone",
          phone: "",
          submissionId: crypto.randomUUID(),
        },
        { ip: "203.0.113.15" },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.match(body.message, /phone number/i);
  });

  it("still accepts when association fails after contact and deal succeed", async () => {
    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };

    // Deterministic id that deliberately contains "c2"/"d2" hex substrings —
    // the old /c2|d2/ body check false-failed on random UUIDs with those digits.
    const submissionId = "c2c2c2c2-d2d2-4d2d-8c2c-d2d2d2d2d2d2";
    const hubspotContactId = "hs-contact-assoc-fail";
    const hubspotDealId = "hs-deal-assoc-fail";

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || "GET").toUpperCase();
        if (url.includes("/contacts/") && method === "PATCH") {
          return new Response("not found", { status: 404 });
        }
        if (url.endsWith("/contacts") && method === "POST") {
          return new Response(JSON.stringify({ id: hubspotContactId }), {
            status: 201,
          });
        }
        if (url.endsWith("/deals") && method === "POST") {
          return new Response(JSON.stringify({ id: hubspotDealId }), {
            status: 201,
          });
        }
        if (url.includes("/associations/") && method === "PUT") {
          return new Response(
            JSON.stringify({ message: "association unavailable" }),
            { status: 400 },
          );
        }
        if (url.endsWith("/notes") && method === "POST") {
          return new Response(JSON.stringify({ id: "n2" }), { status: 201 });
        }
        return new Response("{}", { status: 500 });
      }) as typeof fetch;

      const response = await POST(
        buildFormRequest(
          { ...validFields, submissionId },
          { ip: "203.0.113.16" },
        ),
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.accepted, true);
      assert.equal(body.submissionId, submissionId);
      assert.deepEqual(Object.keys(body).sort(), [
        "accepted",
        "message",
        "ok",
        "submissionId",
      ]);
      assert.equal("contactId" in body, false);
      assert.equal("dealId" in body, false);
      assert.doesNotMatch(JSON.stringify(body), new RegExp(hubspotContactId));
      assert.doesNotMatch(JSON.stringify(body), new RegExp(hubspotDealId));

      const assocWarn = warnCalls.find(
        (args) => args[0] === "[CONCIERGE_ASSOCIATION_NONFATAL]",
      );
      assert.ok(assocWarn, "expected CONCIERGE_ASSOCIATION_NONFATAL warning");
      assert.equal(typeof assocWarn[1], "object");
      const payload = assocWarn[1] as Record<string, unknown>;
      assert.equal(payload.code, "CONCIERGE_ASSOCIATION_NONFATAL");
      assert.equal(payload.submissionId, submissionId.slice(0, 12));
      assert.equal("contactId" in payload, false);
      assert.equal("dealId" in payload, false);
      assert.equal("email" in payload, false);
      const payloadJson = JSON.stringify(payload);
      assert.doesNotMatch(payloadJson, new RegExp(hubspotContactId));
      assert.doesNotMatch(payloadJson, new RegExp(hubspotDealId));
      assert.doesNotMatch(payloadJson, /alex\.example/i);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("still accepts when note creation fails after contact and deal succeed", async () => {
    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };

    const submissionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const hubspotContactId = "hs-contact-note-fail";
    const hubspotDealId = "hs-deal-note-fail";

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || "GET").toUpperCase();
        if (url.includes("/contacts/") && method === "PATCH") {
          return new Response("not found", { status: 404 });
        }
        if (url.endsWith("/contacts") && method === "POST") {
          return new Response(JSON.stringify({ id: hubspotContactId }), {
            status: 201,
          });
        }
        if (url.endsWith("/deals") && method === "POST") {
          return new Response(JSON.stringify({ id: hubspotDealId }), {
            status: 201,
          });
        }
        if (url.includes("/associations/") && method === "PUT") {
          return new Response(null, { status: 204 });
        }
        if (url.endsWith("/notes") && method === "POST") {
          return new Response(JSON.stringify({ message: "note rejected" }), {
            status: 400,
          });
        }
        return new Response("{}", { status: 500 });
      }) as typeof fetch;

      const response = await POST(
        buildFormRequest(
          { ...validFields, submissionId },
          { ip: "203.0.113.17" },
        ),
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.accepted, true);
      assert.equal(body.submissionId, submissionId);
      assert.equal("contactId" in body, false);
      assert.equal("dealId" in body, false);

      const noteWarn = warnCalls.find(
        (args) => args[0] === "[CONCIERGE_NOTE_NONFATAL]",
      );
      assert.ok(noteWarn, "expected CONCIERGE_NOTE_NONFATAL warning");
      const payload = noteWarn[1] as Record<string, unknown>;
      assert.equal(payload.code, "CONCIERGE_NOTE_NONFATAL");
      assert.equal(payload.submissionId, submissionId.slice(0, 12));
      assert.equal("contactId" in payload, false);
      assert.equal("dealId" in payload, false);
      assert.equal("email" in payload, false);
      const payloadJson = JSON.stringify(payload);
      assert.doesNotMatch(payloadJson, new RegExp(hubspotContactId));
      assert.doesNotMatch(payloadJson, new RegExp(hubspotDealId));
      assert.doesNotMatch(payloadJson, /alex\.example/i);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("retries preferred_contact_method only once on HubSpot 400 without duplicating creates", async () => {
    let contactCreates = 0;
    let dealCreates = 0;
    let patchCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      const bodyText = typeof init?.body === "string" ? init.body : "";

      if (url.includes("/contacts/") && method === "PATCH") {
        patchCalls += 1;
        if (bodyText.includes("preferred_contact_method")) {
          return new Response(
            JSON.stringify({
              message: "Property values were not valid: preferred_contact_method",
            }),
            { status: 400 },
          );
        }
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/contacts") && method === "POST") {
        contactCreates += 1;
        return new Response(JSON.stringify({ id: `contact-${contactCreates}` }), {
          status: 201,
        });
      }
      if (url.endsWith("/deals") && method === "POST") {
        dealCreates += 1;
        return new Response(JSON.stringify({ id: `deal-${dealCreates}` }), {
          status: 201,
        });
      }
      if (url.includes("/associations/") && method === "PUT") {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/notes") && method === "POST") {
        return new Response(JSON.stringify({ id: "n4" }), { status: 201 });
      }
      return new Response("{}", { status: 500 });
    }) as typeof fetch;

    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId: crypto.randomUUID() },
        { ip: "203.0.113.18" },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.accepted, true);
    assert.equal(patchCalls, 2);
    assert.equal(contactCreates, 1);
    assert.equal(dealCreates, 1);
  });

  it("soft-accepts honeypot without calling HubSpot", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 500 });
    }) as typeof fetch;

    const response = await POST(
      buildFormRequest({
        ...validFields,
        company_website: "https://bot.example",
        submissionId: crypto.randomUUID(),
      }),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.accepted, false);
    assert.equal(fetchCalls, 0);
  });

  it("SLA disabled: contact → deal → association/note → accepted with zero SLA side effects", async () => {
    delete process.env.CONCIERGE_SLA_ENABLED;
    process.env.CONCIERGE_SLA_TEST_MEMORY = "1";

    let contactPosts = 0;
    let dealPosts = 0;
    let associationPuts = 0;
    let notePosts = 0;
    let taskCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/crm/v3/objects/contacts/") && method === "PATCH") {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/crm/v3/objects/contacts") && method === "POST") {
        contactPosts += 1;
        return new Response(JSON.stringify({ id: "contact-legacy" }), {
          status: 201,
        });
      }
      if (url.endsWith("/crm/v3/objects/deals") && method === "POST") {
        dealPosts += 1;
        return new Response(JSON.stringify({ id: "deal-legacy" }), {
          status: 201,
        });
      }
      if (url.includes("/associations/deals/") && method === "PUT") {
        associationPuts += 1;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/crm/v3/objects/notes") && method === "POST") {
        notePosts += 1;
        return new Response(JSON.stringify({ id: "note-legacy" }), {
          status: 201,
        });
      }
      if (url.includes("/tasks")) {
        taskCalls += 1;
        return new Response(
          JSON.stringify({ message: "SLA task API must not run when disabled" }),
          { status: 500 },
        );
      }
      return new Response(
        JSON.stringify({ message: `unmocked ${method} ${url}` }),
        { status: 500 },
      );
    }) as typeof fetch;

    const submissionId = crypto.randomUUID();
    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId },
        { ip: "203.0.113.90" },
      ),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.accepted, true);
    assert.equal(contactPosts, 1);
    assert.equal(dealPosts, 1);
    assert.ok(associationPuts >= 1);
    assert.equal(notePosts, 1);
    assert.equal(taskCalls, 0);

    const store = getDefaultConciergeSlaStore() as
      | (ReturnType<typeof createMemoryConciergeSlaStore>)
      | null;
    assert.ok(store);
    assert.equal((await store.listOpen()).length, 0);
    assert.equal(store._rows.size, 0);
  });

  it("SLA enabled: creates follow-up task after accepted deal", async () => {
    process.env.CONCIERGE_SLA_ENABLED = "true";
    process.env.CONCIERGE_SLA_TEST_MEMORY = "1";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONCIERGE_ALERT_EMAIL_FROM = "alerts@hourglass.test";
    process.env.CONCIERGE_ALERT_EMAIL_TO = "founder@hourglass.test";

    let taskCreates = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();

      if (url.includes("/crm/v3/objects/contacts/") && method === "PATCH") {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/crm/v3/objects/contacts") && method === "POST") {
        return new Response(JSON.stringify({ id: "contact-sla" }), {
          status: 201,
        });
      }
      if (url.endsWith("/crm/v3/objects/deals") && method === "POST") {
        return new Response(JSON.stringify({ id: "deal-sla" }), { status: 201 });
      }
      if (url.includes("/associations/deals/") && method === "PUT") {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/crm/v3/objects/notes") && method === "POST") {
        return new Response(JSON.stringify({ id: "note-sla" }), { status: 201 });
      }
      if (url.includes("/associations/tasks") && method === "GET") {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("/crm/v3/objects/tasks/") && method === "GET") {
        return new Response(null, { status: 404 });
      }
      if (url.endsWith("/crm/v3/objects/tasks") && method === "POST") {
        taskCreates += 1;
        return new Response(JSON.stringify({ id: "task-sla" }), { status: 201 });
      }
      if (url.includes("/crm/v3/owners/") && method === "GET") {
        return new Response(JSON.stringify({ id: "owner-1" }), { status: 200 });
      }
      if (url.includes("api.resend.com/emails") && method === "POST") {
        return new Response(JSON.stringify({ id: "email-sla" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ message: `unmocked ${method} ${url}` }),
        { status: 500 },
      );
    }) as typeof fetch;

    const submissionId = crypto.randomUUID();
    const response = await POST(
      buildFormRequest(
        { ...validFields, submissionId },
        { ip: "203.0.113.91" },
      ),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.accepted, true);
    assert.equal(taskCreates, 1);

    const store = getDefaultConciergeSlaStore();
    assert.ok(store);
    const row = await store.getByDealId("deal-sla");
    assert.ok(row);
    assert.equal(row.taskId, "task-sla");
  });
});
