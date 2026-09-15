import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { SERVER_ONLY_CONTINUUM_CALENDAR_ENV } from "@/lib/continuum/calendar/env";
import { SERVER_ONLY_CONTINUUM_GMAIL_ENV } from "@/lib/continuum/gmail/env";
import {
  assertNoPrefixedServerSecrets,
  SERVER_ONLY_APP_ENV,
} from "./validate-env";

const DIR = dirname(fileURLToPath(import.meta.url));

const GMAIL_KEK = "NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK";
const GMAIL_OAUTH_SECRET = "NEXT_PUBLIC_CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET";
const CALENDAR_KEK = "NEXT_PUBLIC_CONTINUUM_CALENDAR_TOKEN_KEK";
const CALENDAR_OAUTH_SECRET =
  "NEXT_PUBLIC_CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET";
const PUBLIC_PROBE_KEYS = [
  GMAIL_KEK,
  GMAIL_OAUTH_SECRET,
  CALENDAR_KEK,
  CALENDAR_OAUTH_SECRET,
] as const;

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function clearPublicProbes(): Record<string, undefined> {
  return Object.fromEntries(PUBLIC_PROBE_KEYS.map((key) => [key, undefined]));
}

describe("assertNoPrefixedServerSecrets Continuum Gmail/Calendar", () => {
  it("wires Gmail and Calendar server-only names into the startup guard", () => {
    const source = readFileSync(join(DIR, "validate-env.ts"), "utf8");
    assert.match(source, /SERVER_ONLY_CONTINUUM_GMAIL_ENV/);
    assert.match(source, /SERVER_ONLY_CONTINUUM_CALENDAR_ENV/);
    assert.ok(SERVER_ONLY_CONTINUUM_GMAIL_ENV.includes("CONTINUUM_GMAIL_TOKEN_KEK"));
    assert.ok(
      SERVER_ONLY_CONTINUUM_GMAIL_ENV.includes(
        "CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET",
      ),
    );
    assert.ok(
      SERVER_ONLY_CONTINUUM_CALENDAR_ENV.includes("CONTINUUM_CALENDAR_TOKEN_KEK"),
    );
    assert.ok(
      SERVER_ONLY_CONTINUUM_CALENDAR_ENV.includes(
        "CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET",
      ),
    );
  });

  it("rejects NEXT_PUBLIC_CONTINUUM_GMAIL_TOKEN_KEK", () => {
    withEnv({ ...clearPublicProbes(), [GMAIL_KEK]: "x" }, () => {
      assert.throws(
        () => assertNoPrefixedServerSecrets(),
        /CONTINUUM_GMAIL_TOKEN_KEK must not use NEXT_PUBLIC_/,
      );
    });
  });

  it("rejects NEXT_PUBLIC Gmail OAuth client secret", () => {
    withEnv({ ...clearPublicProbes(), [GMAIL_OAUTH_SECRET]: "x" }, () => {
      assert.throws(
        () => assertNoPrefixedServerSecrets(),
        /CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET must not use NEXT_PUBLIC_/,
      );
    });
  });

  it("rejects NEXT_PUBLIC Calendar KEK", () => {
    withEnv({ ...clearPublicProbes(), [CALENDAR_KEK]: "x" }, () => {
      assert.throws(
        () => assertNoPrefixedServerSecrets(),
        /CONTINUUM_CALENDAR_TOKEN_KEK must not use NEXT_PUBLIC_/,
      );
    });
  });

  it("rejects NEXT_PUBLIC Calendar OAuth client secret", () => {
    withEnv({ ...clearPublicProbes(), [CALENDAR_OAUTH_SECRET]: "x" }, () => {
      assert.throws(
        () => assertNoPrefixedServerSecrets(),
        /CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET must not use NEXT_PUBLIC_/,
      );
    });
  });

  it("accepts legitimate server-only names and NEXT_PUBLIC_GA_ID", () => {
    withEnv(
      {
        ...clearPublicProbes(),
        CONTINUUM_GMAIL_TOKEN_KEK: "x",
        CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET: "x",
        CONTINUUM_CALENDAR_TOKEN_KEK: "x",
        CONTINUUM_CALENDAR_OAUTH_CLIENT_SECRET: "x",
        EXECUTIVE_DASHBOARD_SESSION_SECRET: "x".repeat(32),
        NEXT_PUBLIC_GA_ID: "G-TESTONLY",
      },
      () => {
        assert.doesNotThrow(() => assertNoPrefixedServerSecrets());
      },
    );
    assert.ok(SERVER_ONLY_APP_ENV.includes("EXECUTIVE_DASHBOARD_SESSION_SECRET"));
  });
});
