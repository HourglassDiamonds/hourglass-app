import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { GMAIL_READONLY_SCOPE } from "@/lib/continuum/gmail/types";

const CALENDAR_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(CALENDAR_DIR, "../../..");

describe("Calendar does not regress Gmail OAuth", () => {
  it("keeps Gmail OAuth on gmail.readonly with include_granted_scopes false", () => {
    const oauth = readFileSync(join(ROOT, "lib/continuum/gmail/oauth.ts"), "utf8");
    const types = readFileSync(join(ROOT, "lib/continuum/gmail/types.ts"), "utf8");
    assert.equal(
      GMAIL_READONLY_SCOPE,
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    assert.match(types, /https:\/\/www\.googleapis\.com\/auth\/gmail\.readonly/);
    assert.match(oauth, /scope: GMAIL_READONLY_SCOPE/);
    assert.match(oauth, /include_granted_scopes: "false"/);
    assert.doesNotMatch(oauth, /calendar\.readonly/);
    assert.doesNotMatch(oauth, /auth\/calendar"/);
  });

  it("does not reuse Gmail token custody or client env from Calendar", () => {
    const calendarOauth = readFileSync(join(CALENDAR_DIR, "oauth.ts"), "utf8");
    const calendarEnv = readFileSync(join(CALENDAR_DIR, "env.ts"), "utf8");
    const calendarCrypto = readFileSync(join(CALENDAR_DIR, "token-crypto.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(calendarOauth, /CONTINUUM_GMAIL_/);
    assert.doesNotMatch(calendarEnv, /CONTINUUM_GMAIL_/);
    assert.doesNotMatch(calendarEnv, /GOOGLE_CLIENT_ID|GOOGLE_REFRESH_TOKEN/);
    assert.doesNotMatch(calendarCrypto, /CONTINUUM_GMAIL_TOKEN_KEK/);
    assert.match(calendarEnv, /CONTINUUM_CALENDAR_TOKEN_KEK/);
    assert.match(calendarOauth, /include_granted_scopes: "false"/);
  });

  it("leaves Gmail OAuth routes and handlers unchanged in this lane", () => {
    const start = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/start/route.ts"),
      "utf8",
    );
    const callback = readFileSync(
      join(ROOT, "app/api/continuum/gmail/oauth/callback/route.ts"),
      "utf8",
    );
    const handlers = readFileSync(
      join(ROOT, "lib/continuum/gmail/handlers.ts"),
      "utf8",
    );
    assert.doesNotMatch(start, /calendar/i);
    assert.doesNotMatch(callback, /calendar/i);
    assert.match(handlers, /GMAIL_READONLY_SCOPE/);
    assert.doesNotMatch(handlers, /calendar\.readonly/);
  });
});
