/**
 * Local QA harness for founder dashboard auth (synthetic credentials only).
 * Reads .qa-auth-temp.json — never logs secrets or passwords.
 *
 * Usage: node scripts/qa-executive-dashboard-auth.mjs
 */
import { spawn } from "node:child_process";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.QA_PORT || 3460);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "TestOnly-Founder-Pass-2026!";
const USERNAME = "founder";
const SECRET_PATH = join(ROOT, ".qa-auth-temp.json");

function loadQaSecrets() {
  if (existsSync(SECRET_PATH)) {
    return JSON.parse(readFileSync(SECRET_PATH, "utf8"));
  }
  const salt = randomBytes(16);
  const hashBuf = scryptSync(PASSWORD, salt, 32, { N: 16384, r: 8, p: 1 });
  const secrets = {
    hash: `scrypt$${salt.toString("base64url")}$${hashBuf.toString("base64url")}`,
    secret: randomBytes(32).toString("hex"),
  };
  writeFileSync(SECRET_PATH, JSON.stringify(secrets));
  return secrets;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createSessionToken(username, secret, nowMs = Date.now(), maxAgeSec = 43200) {
  const iat = Math.floor(nowMs / 1000);
  const payload = { v: 1, u: username, iat, exp: iat + maxAgeSec };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPasswordAgainstHash(password, storedHash) {
  const parts = storedHash.split("$");
  assert(parts[0] === "scrypt" && parts.length === 3, "bad hash format");
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  const actual = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

async function waitForServer(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.status > 0) return;
    } catch {
      // retry
    }
    await sleep(400);
  }
  throw new Error("Server did not become ready");
}

async function run() {
  const secrets = loadQaSecrets();
  assert(
    verifyPasswordAgainstHash(PASSWORD, secrets.hash),
    "synthetic password does not match stored hash",
  );

  const env = {
    ...process.env,
    EXECUTIVE_DASHBOARD_USERNAME: USERNAME,
    EXECUTIVE_DASHBOARD_PASSWORD_HASH: secrets.hash,
    EXECUTIVE_DASHBOARD_SESSION_SECRET: secrets.secret,
    PORT: String(PORT),
  };

  const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  let serverLog = "";
  child.stdout.on("data", (d) => {
    serverLog += d.toString();
  });
  child.stderr.on("data", (d) => {
    serverLog += d.toString();
  });

  const results = [];
  try {
    await waitForServer();

    {
      const res = await fetch(`${BASE}/executive-dashboard`, {
        redirect: "manual",
      });
      const loc = res.headers.get("location") || "";
      const body = await res.text();
      assert(
        res.status === 307 || res.status === 302 || res.status === 303,
        `unauth status ${res.status}`,
      );
      assert(loc.includes("/executive-dashboard/login"), `loc ${loc}`);
      assert(!body.includes("Weekly Signal"), "dashboard leaked in redirect body");
      assert(!/consultationFunnel|brandDemand/.test(body), "payload leaked");
      results.push("1 unauth redirect: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard/login`);
      const body = await res.text();
      const cache = res.headers.get("cache-control") || "";
      const robots = res.headers.get("x-robots-tag") || "";
      assert(res.status === 200, `login status ${res.status}`);
      assert(body.includes("executive-dashboard-username"), "missing username field");
      assert(body.includes("executive-dashboard-password"), "missing password field");
      assert(!body.includes("Weekly Signal"), "dashboard content on login");
      assert(cache.includes("no-store") || cache.includes("private"), `cache ${cache}`);
      assert(robots.includes("noindex"), `robots ${robots}`);
      assert(!body.includes(PASSWORD), "password in html");
      assert(!body.includes(secrets.hash), "hash leaked");
      assert(!body.includes(secrets.secret), "secret leaked");
      results.push("2 login page + headers: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard/does-not-exist-yet`, {
        redirect: "manual",
      });
      const loc = res.headers.get("location") || "";
      assert(
        res.status === 307 || res.status === 302 || res.status === 303,
        `nested ${res.status}`,
      );
      assert(loc.includes("/executive-dashboard/login"), `nested loc ${loc}`);
      results.push("3 nested unauth: pass");
    }

    {
      const res = await fetch(`${BASE}/`);
      assert(res.status === 200, `home ${res.status}`);
      results.push("4 public home: pass");
    }

    const validToken = createSessionToken(USERNAME, secrets.secret);
    {
      const res = await fetch(`${BASE}/executive-dashboard`, {
        redirect: "manual",
        headers: { cookie: `hgd_ed_session=${validToken}` },
      });
      assert(res.status === 200, `auth dash ${res.status}`);
      const body = await res.text();
      assert(
        body.includes("Weekly Signal") ||
          body.includes("Executive") ||
          body.includes("Sign out"),
        "authenticated dashboard missing expected UI",
      );
      assert(!body.includes(PASSWORD), "password in authenticated html");
      const cache = res.headers.get("cache-control") || "";
      assert(cache.includes("no-store") || cache.includes("private"), `auth cache ${cache}`);
      results.push("5 valid session dashboard: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard/does-not-exist-yet`, {
        redirect: "manual",
        headers: { cookie: `hgd_ed_session=${validToken}` },
      });
      // Authenticated nested unknown routes must not leak login or metrics;
      // expect App Router 404, not a dashboard payload.
      assert(res.status === 404 || res.status === 200, `nested auth ${res.status}`);
      const body = await res.text();
      assert(!body.includes("Weekly Signal"), "404 nested leaked dashboard");
      results.push("6 nested auth path gated: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard`, {
        redirect: "manual",
        headers: { cookie: "hgd_ed_session=tampered.payload.value" },
      });
      const loc = res.headers.get("location") || "";
      assert(
        res.status === 307 || res.status === 302 || res.status === 303,
        `tamper ${res.status}`,
      );
      assert(loc.includes("/login"), `tamper loc ${loc}`);
      results.push("7 tampered cookie: pass");
    }

    {
      const expired = createSessionToken(
        USERNAME,
        secrets.secret,
        Date.now() - 120_000,
        30,
      );
      const res = await fetch(`${BASE}/executive-dashboard`, {
        redirect: "manual",
        headers: { cookie: `hgd_ed_session=${expired}` },
      });
      const loc = res.headers.get("location") || "";
      assert(
        res.status === 307 || res.status === 302 || res.status === 303,
        `expired ${res.status}`,
      );
      assert(loc.includes("/login"), `expired loc ${loc}`);
      results.push("8 expired cookie: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard`, {
        redirect: "manual",
        headers: { cookie: "hgd_ed_session=" },
      });
      assert((res.headers.get("location") || "").includes("/login"), "logout clear");
      results.push("9 cleared cookie: pass");
    }

    {
      const res = await fetch(`${BASE}/executive-dashboard/login`, {
        redirect: "manual",
        headers: { cookie: `hgd_ed_session=${validToken}` },
      });
      const loc = res.headers.get("location") || "";
      assert(
        res.status === 307 || res.status === 302 || res.status === 303,
        `authed login ${res.status}`,
      );
      assert(
        loc.endsWith("/executive-dashboard") || loc.includes("/executive-dashboard?"),
        `authed login loc ${loc}`,
      );
      results.push("10 authed login redirect: pass");
    }

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          results,
          serverLogTail: serverLog.slice(-800),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    child.kill("SIGTERM");
    await sleep(800);
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

run();
