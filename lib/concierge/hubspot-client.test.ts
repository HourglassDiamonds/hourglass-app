import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  HubSpotConfigError,
  HubSpotRequestError,
  hubspotFetchJson,
  resolveHubSpotToken,
  sanitizeHubSpotErrorBody,
} from "./hubspot-client";

describe("resolveHubSpotToken", () => {
  it("prefers HUBSPOT_ACCESS_TOKEN when both are set", () => {
    const result = resolveHubSpotToken({
      HUBSPOT_ACCESS_TOKEN: "pat-access-token-value",
      HUBSPOT_PRIVATE_APP_TOKEN: "pat-private-token-value",
    });
    assert.equal(result.source, "HUBSPOT_ACCESS_TOKEN");
    assert.equal(result.token, "pat-access-token-value");
  });

  it("falls back to HUBSPOT_PRIVATE_APP_TOKEN when access token is empty", () => {
    const result = resolveHubSpotToken({
      HUBSPOT_ACCESS_TOKEN: "   ",
      HUBSPOT_PRIVATE_APP_TOKEN: "pat-private-only",
    });
    assert.equal(result.source, "HUBSPOT_PRIVATE_APP_TOKEN");
    assert.equal(result.token, "pat-private-only");
  });

  it("returns null when both token names are absent or empty", () => {
    assert.deepEqual(resolveHubSpotToken({}), { token: null, source: null });
    assert.deepEqual(
      resolveHubSpotToken({
        HUBSPOT_ACCESS_TOKEN: "",
        HUBSPOT_PRIVATE_APP_TOKEN: "",
      }),
      { token: null, source: null },
    );
  });
});

describe("sanitizeHubSpotErrorBody", () => {
  it("redacts bearer tokens, emails, and pat tokens", () => {
    const sanitized = sanitizeHubSpotErrorBody(
      'Bearer pat-na1-abc123def Authorization error for user@example.com with pat-eu1-zzzzzzzzzzzzzzzzzzzz',
    );
    assert.doesNotMatch(sanitized, /pat-na1-abc123def/i);
    assert.doesNotMatch(sanitized, /user@example.com/i);
    assert.match(sanitized, /Bearer \[redacted\]/);
    assert.match(sanitized, /\[redacted-email\]/);
  });
});

describe("hubspotFetchJson", () => {
  afterEach(() => {
    // no shared mutable state beyond mocks passed per test
  });

  it("sends Authorization Bearer and Content-Type application/json", async () => {
    let seenAuth = "";
    let seenContentType = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      const headers = new Headers(init?.headers);
      seenAuth = headers.get("Authorization") || "";
      seenContentType = headers.get("Content-Type") || "";
      return new Response(JSON.stringify({ id: "1" }), { status: 200 });
    };

    const result = await hubspotFetchJson<{ id: string }>(
      "/crm/v3/objects/contacts",
      { method: "GET" },
      { token: "pat-test-token", fetchImpl },
    );

    assert.equal(result?.id, "1");
    assert.equal(seenAuth, "Bearer pat-test-token");
    assert.equal(seenContentType, "application/json");
  });

  it("throws HubSpotConfigError when token is missing", async () => {
    await assert.rejects(
      () =>
        hubspotFetchJson(
          "/crm/v3/objects/contacts",
          { method: "GET" },
          {
            token: "",
            fetchImpl: async () => new Response("{}", { status: 200 }),
          },
        ),
      (error: unknown) => error instanceof HubSpotConfigError,
    );
  });

  it("throws HubSpotRequestError on HubSpot authentication failure", async () => {
    await assert.rejects(
      () =>
        hubspotFetchJson(
          "/crm/v3/objects/contacts",
          { method: "GET" },
          {
            token: "pat-bad",
            fetchImpl: async () =>
              new Response(
                JSON.stringify({
                  message: "Authentication credentials not found",
                }),
                { status: 401 },
              ),
          },
        ),
      (error: unknown) =>
        error instanceof HubSpotRequestError &&
        error.status === 401 &&
        error.message === "hubspot_request_failed",
    );
  });

  it("throws HubSpotRequestError on HubSpot validation failure", async () => {
    await assert.rejects(
      () =>
        hubspotFetchJson(
          "/crm/v3/objects/contacts",
          { method: "POST" },
          {
            token: "pat-ok",
            fetchImpl: async () =>
              new Response(
                JSON.stringify({
                  message: "Property values were not valid",
                  correlationId: "abc",
                }),
                { status: 400 },
              ),
          },
        ),
      (error: unknown) =>
        error instanceof HubSpotRequestError && error.status === 400,
    );
  });

  it("returns null for 404 when treatNotFoundAsEmpty is set", async () => {
    const result = await hubspotFetchJson(
      "/crm/v3/objects/contacts/missing@example.com?idProperty=email",
      { method: "PATCH", body: "{}" },
      {
        token: "pat-ok",
        treatNotFoundAsEmpty: true,
        fetchImpl: async () => new Response("not found", { status: 404 }),
      },
    );
    assert.equal(result, null);
  });
});
