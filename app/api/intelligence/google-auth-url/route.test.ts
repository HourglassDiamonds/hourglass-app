import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET } from "./route";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("GET /api/intelligence/google-auth-url", () => {
  it("hard-404s in production even when OAuth credentials exist", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      },
      async () => {
        const response = await GET();
        assert.equal(response.status, 404);
        const body = await response.json();
        assert.equal(body.ok, false);
        assert.equal(body.error, "Not found.");
        assert.equal(body.authUrl, undefined);
        assert.equal(typeof body.hint, "undefined");
        const serialized = JSON.stringify(body);
        assert.equal(serialized.includes("googleusercontent"), false);
        assert.equal(serialized.includes("client_secret"), false);
        assert.equal(serialized.includes("accounts.google.com"), false);
      },
    );
  });

  it("hard-404s when NODE_ENV is production even if VERCEL_ENV is unset", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      },
      async () => {
        const response = await GET();
        assert.equal(response.status, 404);
        const body = await response.json();
        assert.equal(body.authUrl, undefined);
      },
    );
  });

  it("still builds a local setup URL outside production", async () => {
    await withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      },
      async () => {
        const response = await GET();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.ok, true);
        assert.equal(typeof body.authUrl, "string");
        assert.match(body.authUrl, /^https:\/\/accounts\.google\.com\//);
        assert.equal(body.authUrl.includes("client_secret"), false);
        assert.equal(
          JSON.stringify(body).includes("test-google-client-secret"),
          false,
        );
      },
    );
  });
});
