import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInterpretDiagnosticsEnabled } from "./interpret-failure-diagnostics";

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

describe("isInterpretDiagnosticsEnabled", () => {
  it("stays off in production even when DI_INTERPRET_DIAGNOSTICS=1", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        DI_INTERPRET_DIAGNOSTICS: "1",
      },
      () => {
        assert.equal(isInterpretDiagnosticsEnabled(), false);
      },
    );
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        DI_INTERPRET_DIAGNOSTICS: "1",
      },
      () => {
        assert.equal(isInterpretDiagnosticsEnabled(), false);
      },
    );
  });

  it("stays off when the flag is unset outside production", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        DI_INTERPRET_DIAGNOSTICS: undefined,
      },
      () => {
        assert.equal(isInterpretDiagnosticsEnabled(), false);
      },
    );
  });

  it("may enable outside production when DI_INTERPRET_DIAGNOSTICS=1", () => {
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        DI_INTERPRET_DIAGNOSTICS: "1",
      },
      () => {
        assert.equal(isInterpretDiagnosticsEnabled(), true);
      },
    );
  });
});
