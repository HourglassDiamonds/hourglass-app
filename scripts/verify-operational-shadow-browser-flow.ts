import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  PRODUCTION_STAGING_AUTH_ROUTE,
  PRODUCTION_STAGING_LOGIN_PATH,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE,
} from "../lib/continuum/production-staging-access";
import {
  buildExecutiveDashboardSessionCookie,
  EXECUTIVE_DASHBOARD_SESSION_COOKIE,
  verifyExecutiveDashboardSessionToken,
} from "../lib/executive-dashboard/session";

const username = "synthetic-founder";
const password = "synthetic-password";
const sessionSecret = "synthetic-browser-flow-session-secret-32-bytes";
const oldRunRoute = "/api/continuum/operational-shadow/run";
const startedAt = new Date().toISOString();

const receipt = {
  startedAt,
  unauthenticatedRunDenied: false,
  oldRouteDenied: false,
  authenticatedPageLoads: 0,
  authenticatedRefreshObserved: false,
  naturalCookieObservedByRun: false,
  syntheticGmailCalls: 0,
  syntheticModelCalls: 0,
  runCalls: 0,
  retrievalCalls: 0,
  resultRecovered: false,
};

let sanitizedResult: Record<string, unknown> | null = null;

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function sendHtml(response: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(`<!doctype html><html><body>${body}</body></html>`);
}

function cookieValue(request: IncomingMessage): string | null {
  const raw = request.headers.cookie ?? "";
  for (const entry of raw.split(";")) {
    const [name, ...value] = entry.trim().split("=");
    if (name === EXECUTIVE_DASHBOARD_SESSION_COOKIE) return value.join("=");
  }
  return null;
}

function authenticated(request: IncomingMessage): boolean {
  const token = cookieValue(request);
  return Boolean(token && verifyExecutiveDashboardSessionToken(token, sessionSecret, username));
}

async function bodyText(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (request.method === "GET" && url.pathname === PRODUCTION_STAGING_LOGIN_PATH) {
    sendHtml(response, 200, `
      <h1>Synthetic shadow browser verification</h1>
      <p id="preflight">checking</p>
      <form method="post" action="${PRODUCTION_STAGING_AUTH_ROUTE}">
        <input name="username" value="${username}">
        <input name="password" type="password" value="${password}">
        <button id="sign-in" type="submit">Sign in</button>
      </form>
      <script>
        Promise.all([
          fetch(${JSON.stringify(PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE)}, { method: "POST" }).then(r => r.status),
          fetch(${JSON.stringify(oldRunRoute)}, { method: "POST" }).then(r => r.status),
        ]).then(([current, old]) => {
          document.querySelector("#preflight").textContent = "preflight:" + current + ":" + old;
        });
      </script>`);
    return;
  }

  if (request.method === "POST" && url.pathname === PRODUCTION_STAGING_AUTH_ROUTE) {
    const form = new URLSearchParams(await bodyText(request));
    if (form.get("username") !== username || form.get("password") !== password) {
      response.writeHead(303, { Location: `${PRODUCTION_STAGING_LOGIN_PATH}?error=invalid` });
      response.end();
      return;
    }
    const cookie = buildExecutiveDashboardSessionCookie(username, sessionSecret);
    const attributes = [
      `${cookie.name}=${cookie.value}`,
      `Path=${cookie.options.path}`,
      `Max-Age=${cookie.options.maxAge}`,
      "HttpOnly",
      `SameSite=${cookie.options.sameSite}`,
    ];
    response.writeHead(303, {
      Location: PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
      "Set-Cookie": attributes.join("; "),
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH) {
    if (!authenticated(request)) {
      response.writeHead(303, { Location: PRODUCTION_STAGING_LOGIN_PATH });
      response.end();
      return;
    }
    receipt.authenticatedPageLoads += 1;
    receipt.authenticatedRefreshObserved = receipt.authenticatedPageLoads >= 2;
    sendHtml(response, 200, `
      <h1>Operational shadow synthetic transport</h1>
      <button id="run">Run synthetic shadow</button>
      <button id="restore">Restore result</button>
      <pre id="result"></pre>
      <script>
        document.querySelector("#run").onclick = async () => {
          const response = await fetch(${JSON.stringify(PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE)}, { method: "POST" });
          document.querySelector("#result").textContent = response.status + ":" + await response.text();
        };
        document.querySelector("#restore").onclick = async () => {
          const response = await fetch(${JSON.stringify(PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE)});
          document.querySelector("#result").textContent = response.status + ":" + await response.text();
        };
      </script>`);
    return;
  }

  if (request.method === "POST" && url.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RUN_ROUTE) {
    if (!authenticated(request)) {
      receipt.unauthenticatedRunDenied = true;
      sendJson(response, 401, { ok: false, reason: "founder-session-unavailable" });
      return;
    }
    receipt.naturalCookieObservedByRun = true;
    receipt.runCalls += 1;
    receipt.syntheticGmailCalls += 1;
    receipt.syntheticModelCalls += 1;
    sanitizedResult = {
      contract: "sterling-operational-shadow-v11-sanitized-result-v1",
      executionId: randomUUID(),
      verdict: "GENERATED",
      coverage: { allowedThreads: 23, completeThreads: 23, evidenceLimitedThreads: 0 },
      transports: { gmail: "synthetic", model: "synthetic" },
    };
    sendJson(response, 200, { ok: true, verdict: "GENERATED", result: sanitizedResult });
    return;
  }

  if (request.method === "GET" && url.pathname === PRODUCTION_STAGING_OPERATIONAL_SHADOW_RESULT_ROUTE) {
    if (!authenticated(request)) {
      sendJson(response, 401, { ok: false, reason: "founder-session-unavailable" });
      return;
    }
    receipt.retrievalCalls += 1;
    receipt.resultRecovered = sanitizedResult !== null;
    sendJson(response, sanitizedResult ? 200 : 404,
      sanitizedResult ? { ok: true, verdict: "GENERATED", result: sanitizedResult } : { ok: false, reason: "stored-result-unavailable" });
    return;
  }

  if (request.method === "POST" && url.pathname === oldRunRoute) {
    receipt.oldRouteDenied = true;
    sendJson(response, 404, { ok: false, reason: "not-found" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/__receipt") {
    sendJson(response, 200, receipt);
    return;
  }

  sendJson(response, 404, { ok: false, reason: "not-found" });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("browser-flow-listen-failed");
  process.stdout.write(`${JSON.stringify({ status: "ready", origin: `http://127.0.0.1:${address.port}`, username, password })}\n`);
});

function close() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
