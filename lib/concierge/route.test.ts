import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { POST } from "@/app/api/concierge/route";
import { resetConciergeRateLimits } from "./rate-limit";

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
    return new Response(JSON.stringify({ message: `unmocked ${method} ${url}` }), {
      status: 500,
    });
  }) as typeof fetch;
}

describe("POST /api/concierge", () => {
  beforeEach(() => {
    resetConciergeRateLimits();
    process.env = { ...ORIGINAL_ENV };
    process.env.HUBSPOT_ACCESS_TOKEN = "pat-test-access-token";
    process.env.HUBSPOT_PRIVATE_APP_TOKEN = "";
    process.env.HUBSPOT_DEAL_PIPELINE_ID = "default";
    process.env.HUBSPOT_DEAL_STAGE_ID_NEW_INQUIRY = "stage-new";
    process.env.CONCIERGE_RATE_LIMIT_DISABLED = "1";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = ORIGINAL_FETCH;
    resetConciergeRateLimits();
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
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || "GET").toUpperCase();
        if (url.includes("/contacts/") && method === "PATCH") {
          return new Response("not found", { status: 404 });
        }
        if (url.endsWith("/contacts") && method === "POST") {
          return new Response(JSON.stringify({ id: "c2" }), { status: 201 });
        }
        if (url.endsWith("/deals") && method === "POST") {
          return new Response(JSON.stringify({ id: "d2" }), { status: 201 });
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
          { ...validFields, submissionId: crypto.randomUUID() },
          { ip: "203.0.113.16" },
        ),
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.accepted, true);
      assert.ok(
        warnings.some((line) => line.includes("CONCIERGE_ASSOCIATION_NONFATAL")),
      );
      assert.doesNotMatch(warnings.join("\n"), /c2|d2|alex\.example/i);
      assert.doesNotMatch(JSON.stringify(body), /c2|d2|contactId|dealId/i);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("still accepts when note creation fails after contact and deal succeed", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || "GET").toUpperCase();
        if (url.includes("/contacts/") && method === "PATCH") {
          return new Response("not found", { status: 404 });
        }
        if (url.endsWith("/contacts") && method === "POST") {
          return new Response(JSON.stringify({ id: "c3" }), { status: 201 });
        }
        if (url.endsWith("/deals") && method === "POST") {
          return new Response(JSON.stringify({ id: "d3" }), { status: 201 });
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
          { ...validFields, submissionId: crypto.randomUUID() },
          { ip: "203.0.113.17" },
        ),
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.accepted, true);
      assert.ok(warnings.some((line) => line.includes("CONCIERGE_NOTE_NONFATAL")));
      assert.doesNotMatch(warnings.join("\n"), /c3|d3|alex\.example/i);
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
});
