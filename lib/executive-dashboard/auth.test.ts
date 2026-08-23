import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  getExecutiveDashboardAccessDecision,
  isExecutiveDashboardConciergePath,
  isExecutiveDashboardPath,
  isExecutiveDashboardPublicAuthPath,
  executiveDashboardPostLoginPath,
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR,
  EXECUTIVE_DASHBOARD_LOGIN_PATH,
  EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
} from "./access";
import {
  getExecutiveDashboardAuthConfig,
  isExecutiveDashboardAuthRateLimitDisabled,
  isExecutiveDashboardPublicProduction,
} from "./env";
import {
  hashExecutiveDashboardPassword,
  usernamesMatch,
  verifyExecutiveDashboardPassword,
} from "./password";
import {
  checkExecutiveDashboardLoginRateLimit,
  recordExecutiveDashboardLoginFailure,
  resetExecutiveDashboardLoginRateLimits,
  EXEC_AUTH_RATE_LIMIT_MAX,
} from "./rate-limit";
import {
  createExecutiveDashboardSessionToken,
  executiveDashboardSessionCookieOptions,
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  EXECUTIVE_DASHBOARD_SESSION_PATH,
  shouldUseSecureExecutiveDashboardCookie,
  verifyExecutiveDashboardSessionToken,
} from "./session";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

describe("executive dashboard auth", () => {
  const username = "founder";
  const password = "correct-horse-test-only";
  let passwordHash = "";
  const sessionSecret = "test-session-secret-32chars-minimum!!";

  beforeEach(() => {
    passwordHash = hashExecutiveDashboardPassword(password);
    resetExecutiveDashboardLoginRateLimits();
  });

  afterEach(() => {
    resetExecutiveDashboardLoginRateLimits();
  });

  it("denies unauthenticated dashboard access outside production", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        EXECUTIVE_DASHBOARD_USERNAME: username,
        EXECUTIVE_DASHBOARD_PASSWORD_HASH: passwordHash,
        EXECUTIVE_DASHBOARD_SESSION_SECRET: sessionSecret,
      },
      () => {
        const decision = getExecutiveDashboardAccessDecision({
          cookieValue: undefined,
        });
        assert.equal(decision.status, "unauthenticated");
      },
    );
  });

  it("allows access with a valid signed session", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        EXECUTIVE_DASHBOARD_USERNAME: username,
        EXECUTIVE_DASHBOARD_PASSWORD_HASH: passwordHash,
        EXECUTIVE_DASHBOARD_SESSION_SECRET: sessionSecret,
      },
      () => {
        const token = createExecutiveDashboardSessionToken(
          username,
          sessionSecret,
        );
        const decision = getExecutiveDashboardAccessDecision({
          cookieValue: token,
        });
        assert.equal(decision.status, "authenticated");
        if (decision.status === "authenticated") {
          assert.equal(decision.username, username);
        }
      },
    );
  });

  it("rejects invalid credentials via timing-safe password verify", () => {
    assert.equal(
      verifyExecutiveDashboardPassword("wrong-password", passwordHash),
      false,
    );
    assert.equal(verifyExecutiveDashboardPassword(password, passwordHash), true);
    assert.equal(usernamesMatch("nope", username), false);
    assert.equal(usernamesMatch(username, username), true);
  });

  it("fails closed when auth environment variables are missing", () => {
    withEnv(
      {
        VERCEL_ENV: "preview",
        EXECUTIVE_DASHBOARD_USERNAME: undefined,
        EXECUTIVE_DASHBOARD_PASSWORD_HASH: undefined,
        EXECUTIVE_DASHBOARD_SESSION_SECRET: undefined,
      },
      () => {
        const config = getExecutiveDashboardAuthConfig();
        assert.equal(config.ok, false);
        const decision = getExecutiveDashboardAccessDecision({
          cookieValue: "anything",
        });
        assert.equal(decision.status, "unauthenticated");
        if (decision.status === "unauthenticated") {
          assert.equal(decision.reason, "missing-config");
        }
      },
    );
  });

  it("ignores local rate-limit bypass in production", () => {
    withEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: undefined,
        EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        assert.equal(isExecutiveDashboardAuthRateLimitDisabled(), false);
      },
    );
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        assert.equal(isExecutiveDashboardAuthRateLimitDisabled(), false);
      },
    );
    withEnv(
      {
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: "1",
      },
      () => {
        assert.equal(isExecutiveDashboardAuthRateLimitDisabled(), true);
      },
    );
  });

  it("rejects tampered session cookies", () => {
    const token = createExecutiveDashboardSessionToken(username, sessionSecret);
    const tampered = `${token.slice(0, -4)}xxxx`;
    assert.equal(
      verifyExecutiveDashboardSessionToken(tampered, sessionSecret, username),
      null,
    );
    const wrongSecret = verifyExecutiveDashboardSessionToken(
      token,
      "different-secret-also-32chars-long!",
      username,
    );
    assert.equal(wrongSecret, null);
  });

  it("rejects expired sessions", () => {
    const now = Date.now();
    const token = createExecutiveDashboardSessionToken(
      username,
      sessionSecret,
      now - 60_000,
      30,
    );
    assert.equal(
      verifyExecutiveDashboardSessionToken(
        token,
        sessionSecret,
        username,
        now + 120_000,
      ),
      null,
    );
  });

  it("logout clears cookie via maxAge 0 path-scoped options", () => {
    const options = executiveDashboardSessionCookieOptions(true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, EXECUTIVE_DASHBOARD_SESSION_PATH);
    assert.ok(options.maxAge > 0);

    const actions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "actions.ts"),
      "utf8",
    );
    assert.match(actions, /maxAge:\s*0/);
    assert.match(actions, /logoutExecutiveDashboard/);
    assert.match(actions, /EXECUTIVE_DASHBOARD_SESSION_COOKIE/);
    assert.equal(EXECUTIVE_DASHBOARD_SESSION_COOKIE, "hgd_ed_session");
  });

  it("uses Secure cookies on Vercel only (local HTTP login remains possible)", () => {
    withEnv({ VERCEL: "1" }, () => {
      assert.equal(shouldUseSecureExecutiveDashboardCookie(), true);
    });
    withEnv({ VERCEL: undefined, NODE_ENV: "production" }, () => {
      assert.equal(shouldUseSecureExecutiveDashboardCookie(), false);
    });
  });

  it("treats nested dashboard routes as protected paths", () => {
    assert.equal(isExecutiveDashboardPath("/executive-dashboard"), true);
    assert.equal(
      isExecutiveDashboardPath("/executive-dashboard/nested-smoke"),
      true,
    );
    assert.equal(isExecutiveDashboardPath("/diamond-studio"), false);
    assert.equal(
      isExecutiveDashboardPublicAuthPath(EXECUTIVE_DASHBOARD_LOGIN_PATH),
      true,
    );
    assert.equal(
      isExecutiveDashboardPublicAuthPath("/executive-dashboard/nested-smoke"),
      false,
    );
  });

  it("does not expose dashboard data through anonymous supporting endpoints", () => {
    const weekly = readFileSync(
      join(ROOT, "app", "api", "intelligence", "weekly-report", "route.ts"),
      "utf8",
    );
    const loadDashboard = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "load-dashboard.ts"),
      "utf8",
    );
    assert.match(weekly, /verifyCronRequest/);
    assert.doesNotMatch(weekly, /buildExecutiveDashboardPayload/);
    assert.match(loadDashboard, /getExecutiveDashboardAccessDecision/);
    assert.match(loadDashboard, /await getLatestWeeklyReport/);
    // Data fetch is after the auth decision branches.
    const authIdx = loadDashboard.indexOf("getExecutiveDashboardAccessDecision({");
    const dataIdx = loadDashboard.indexOf("await getLatestWeeklyReport()");
    assert.ok(authIdx >= 0 && dataIdx > authIdx);
  });

  it("keeps credentials out of URLs and uses generic login errors", () => {
    const actions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "actions.ts"),
      "utf8",
    );
    const access = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "access.ts"),
      "utf8",
    );
    const form = readFileSync(
      join(ROOT, "app", "executive-dashboard", "login-form.tsx"),
      "utf8",
    );
    assert.doesNotMatch(actions, /searchParams|URLSearchParams|\?password|\?secret/);
    assert.match(actions, /EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR/);
    assert.match(access, new RegExp(EXECUTIVE_DASHBOARD_GENERIC_AUTH_ERROR));
    assert.match(form, /autoComplete="username"/);
    assert.match(form, /autoComplete="current-password"/);
    assert.match(form, /htmlFor="executive-dashboard-username"/);
    assert.match(form, /htmlFor="executive-dashboard-password"/);
    assert.match(form, /role="alert"/);
    assert.match(form, /errorRef/);
  });

  it("applies private no-store and noindex semantics", () => {
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");
    const layout = readFileSync(
      join(ROOT, "app", "executive-dashboard", "layout.tsx"),
      "utf8",
    );
    assert.match(proxy, /Cache-Control/);
    assert.match(proxy, /private, no-store/);
    assert.match(proxy, /X-Robots-Tag/);
    assert.match(proxy, /noindex/);
    assert.match(layout, /robots/);
    assert.match(layout, /force-dynamic/);
  });

  it("hides the dashboard on Vercel production (Option B)", () => {
    withEnv(
      {
        VERCEL_ENV: "production",
        EXECUTIVE_DASHBOARD_USERNAME: username,
        EXECUTIVE_DASHBOARD_PASSWORD_HASH: passwordHash,
        EXECUTIVE_DASHBOARD_SESSION_SECRET: sessionSecret,
      },
      () => {
        assert.equal(isExecutiveDashboardPublicProduction(), true);
        const token = createExecutiveDashboardSessionToken(
          username,
          sessionSecret,
        );
        const decision = getExecutiveDashboardAccessDecision({
          cookieValue: token,
        });
        assert.equal(decision.status, "hidden");
        assert.equal(
          executiveDashboardPostLoginPath(),
          EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
        );
      },
    );
  });

  it("terminates production dashboard requests in proxy before the route tree", () => {
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");
    const access = readFileSync(
      join(ROOT, "lib", "executive-dashboard", "access.ts"),
      "utf8",
    );
    assert.match(access, /EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH/);
    assert.match(
      access,
      new RegExp(
        EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
      ),
    );
    assert.doesNotMatch(
      EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
      /^\/executive-dashboard/,
    );
    assert.match(proxy, /status === "hidden"/);
    assert.match(proxy, /NextResponse\.rewrite/);
    assert.match(proxy, /EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH/);
    // Must not fall through into the dashboard App Router tree on production.
    assert.doesNotMatch(
      proxy,
      /status === "hidden"[\s\S]*?return NextResponse\.next\(\)/,
    );
  });

  it("keeps production hard-404 free of dashboard login copy and metadata sources", () => {
    const loginPage = readFileSync(
      join(ROOT, "app", "executive-dashboard", "login", "page.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      join(ROOT, "app", "executive-dashboard", "layout.tsx"),
      "utf8",
    );
    const protectedLayout = readFileSync(
      join(ROOT, "app", "executive-dashboard", "(protected)", "layout.tsx"),
      "utf8",
    );
    assert.match(loginPage, /Continuum/);
    assert.match(loginPage, /Sign in with founder credentials/);
    assert.match(layout, /CONTINUUM_APP_NAME|applicationName/);
    assert.match(protectedLayout, /notFound\(\)/);
    assert.match(protectedLayout, /getExecutiveDashboardAccessDecision/);
  });

  it("bounds repeated login failures in memory", () => {
    withEnv(
      {
        NODE_ENV: "development",
        EXECUTIVE_DASHBOARD_AUTH_RATE_LIMIT_DISABLED: undefined,
      },
      () => {
        const ip = "203.0.113.50";
        for (let i = 0; i < EXEC_AUTH_RATE_LIMIT_MAX; i += 1) {
          assert.equal(checkExecutiveDashboardLoginRateLimit(ip).allowed, true);
          recordExecutiveDashboardLoginFailure(ip);
        }
        const blocked = checkExecutiveDashboardLoginRateLimit(ip);
        assert.equal(blocked.allowed, false);
      },
    );
  });

  it("documents CSRF mitigation via Next.js server actions POST form", () => {
    const form = readFileSync(
      join(ROOT, "app", "executive-dashboard", "login-form.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(ROOT, "app", "executive-dashboard", "actions.ts"),
      "utf8",
    );
    assert.match(actions, /"use server"/);
    assert.match(form, /useActionState/);
    assert.match(form, /formAction/);
    assert.doesNotMatch(form, /method="post"/);
  });

  it("leaves public marketing routes outside the proxy matcher", () => {
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");
    const matcher = proxy.slice(proxy.indexOf("matcher:"));
    assert.match(
      proxy,
      /matcher:\s*\[["']\/executive-dashboard["'],\s*["']\/executive-dashboard\/:path\*["']\]/,
    );
    assert.doesNotMatch(matcher, /["']\/concierge["']/);
    assert.doesNotMatch(matcher, /diamond-studio|analyze-sparkle/);
  });

  it("keeps the production rewrite target outside all app routes", () => {
    assert.equal(
      EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH.startsWith("/"),
      true,
    );
    assert.equal(
      isExecutiveDashboardPath(
        EXECUTIVE_DASHBOARD_PRODUCTION_NOT_FOUND_REWRITE_PATH,
      ),
      false,
    );
    // No App Router page should claim this path.
    const candidates = [
      join(ROOT, "app", "__hg_production_not_found__", "page.tsx"),
      join(ROOT, "app", "__hg_production_not_found__", "page.ts"),
      join(ROOT, "app", "__hg_production_not_found__", "route.ts"),
    ];
    for (const candidate of candidates) {
      try {
        readFileSync(candidate);
        assert.fail(`unexpected route file: ${candidate}`);
      } catch (error) {
        assert.equal(
          error && typeof error === "object" && "code" in error
            ? error.code
            : null,
          "ENOENT",
        );
      }
    }
  });

  it("gates Concierge under the founder session path without exposing public /concierge", () => {
    assert.equal(
      isExecutiveDashboardConciergePath("/executive-dashboard/concierge"),
      true,
    );
    assert.equal(
      isExecutiveDashboardConciergePath(
        "/executive-dashboard/concierge/client/abc",
      ),
      true,
    );
    assert.equal(isExecutiveDashboardConciergePath("/concierge"), false);
    assert.equal(isExecutiveDashboardPublicAuthPath("/executive-dashboard/login"), true);
    const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");
    assert.match(proxy, /isExecutiveDashboardConciergePath/);
    assert.match(proxy, /readExecutiveDashboardSession/);
    const conciergeLayout = readFileSync(
      join(ROOT, "app", "executive-dashboard", "concierge", "layout.tsx"),
      "utf8",
    );
    assert.match(conciergeLayout, /requireInternalClientMemorySession/);
    assert.match(conciergeLayout, /force-dynamic/);
  });
});
