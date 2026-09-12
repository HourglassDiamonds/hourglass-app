/**
 * Local Continuum Preview launcher.
 * Does not overwrite .env.local. Does not print secrets.
 * Does not start against Production Supabase.
 *
 *   node scripts/continuum-preview-dev.mjs --assert-only
 *   node scripts/continuum-preview-dev.mjs
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PREVIEW_REF = "hrmpzplffuhhvbtxxhnt";
const PRODUCTION_REF = "bnafadfgrrriblppeubp";
const SANDBOX_ENV_PATH = ".env.continuum-preview.local";
const SANDBOX_MAILBOX = "hourglass.continuum.test@gmail.com";
const LOCAL_GMAIL_REDIRECT =
  "http://localhost:3000/api/continuum/gmail/oauth/callback";

const NEVER_INHERIT = new Set([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CONTINUUM_GMAIL_TOKEN_KEK",
  "CONTINUUM_GMAIL_FOUNDER_EMAIL",
  "CONTINUUM_ENV",
  "CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF",
  "CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF",
  "CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED",
  "EXECUTIVE_DASHBOARD_SESSION_SECRET",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_TARGET_ENV",
  "VERCEL_OIDC_TOKEN",
]);

function parseEnvFile(relativePath) {
  const path = resolve(process.cwd(), relativePath);
  if (!existsSync(path)) return {};
  const map = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function envPresent(value) {
  return Boolean(value && value.trim());
}

function applyMap(map, { inherit = false } = {}) {
  for (const [key, value] of Object.entries(map)) {
    if (inherit && NEVER_INHERIT.has(key)) continue;
    if (!envPresent(value)) continue;
    process.env[key] = value;
  }
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function supabaseHostRef(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function ensureSandboxEnvFile() {
  const path = resolve(process.cwd(), SANDBOX_ENV_PATH);
  const existing = parseEnvFile(SANDBOX_ENV_PATH);
  const generated = [];
  const next = { ...existing };

  next.CONTINUUM_ENV = "preview";
  next.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF = PREVIEW_REF;
  next.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF = PRODUCTION_REF;
  next.SUPABASE_URL = `https://${PREVIEW_REF}.supabase.co`;
  next.CONTINUUM_GMAIL_FOUNDER_EMAIL = SANDBOX_MAILBOX;
  next.CONTINUUM_GMAIL_OAUTH_REDIRECT_URI = LOCAL_GMAIL_REDIRECT;
  if (!envPresent(next.CONTINUUM_GMAIL_TOKEN_KEK)) {
    next.CONTINUUM_GMAIL_TOKEN_KEK = randomBytes(32).toString("hex");
    generated.push("CONTINUUM_GMAIL_TOKEN_KEK");
  }
  if (!envPresent(next.EXECUTIVE_DASHBOARD_SESSION_SECRET)) {
    next.EXECUTIVE_DASHBOARD_SESSION_SECRET = randomBytes(32).toString("hex");
    generated.push("EXECUTIVE_DASHBOARD_SESSION_SECRET");
  }

  const incrementalRaw =
    existing.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED?.trim() ?? "";
  const incrementalEnabled =
    incrementalRaw === "true" || incrementalRaw === "1";
  if (incrementalEnabled) {
    next.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED = "true";
  }

  const created = !existsSync(path);
  const incrementalBlock = incrementalEnabled
    ? `
# Isolated local Preview only. Never set on Vercel or Production.
CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED=true
`
    : "";
  const body = `# LOCAL Continuum Preview sandbox. Gitignored. Do not commit.
# Do not copy Production Supabase, Gmail tokens, or Production KEK into this file.
# Launch with: npm run dev:continuum-preview
# CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED may be true in this file only after
# isolation is proven. Never set it on Vercel or Production.

CONTINUUM_ENV=preview
CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF=${PREVIEW_REF}
CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF=${PRODUCTION_REF}
SUPABASE_URL=https://${PREVIEW_REF}.supabase.co

# Paste the Preview service_role key from the Supabase dashboard for ${PREVIEW_REF}.
# Settings → API → service_role. Do not use Production. Do not paste into Cursor chat.
SUPABASE_SERVICE_ROLE_KEY=${next.SUPABASE_SERVICE_ROLE_KEY ?? ""}

CONTINUUM_GMAIL_FOUNDER_EMAIL=${SANDBOX_MAILBOX}
CONTINUUM_GMAIL_TOKEN_KEK=${next.CONTINUUM_GMAIL_TOKEN_KEK}
EXECUTIVE_DASHBOARD_SESSION_SECRET=${next.EXECUTIVE_DASHBOARD_SESSION_SECRET}

# Reuse the existing Continuum Gmail OAuth client. Do not change Production redirect URIs.
# Localhost callback is already the documented redirect:
# ${LOCAL_GMAIL_REDIRECT}
CONTINUUM_GMAIL_OAUTH_CLIENT_ID=${next.CONTINUUM_GMAIL_OAUTH_CLIENT_ID ?? ""}
CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET=${next.CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET ?? ""}
CONTINUUM_GMAIL_OAUTH_REDIRECT_URI=${LOCAL_GMAIL_REDIRECT}
${incrementalBlock}`;
  writeFileSync(path, body, { encoding: "utf8", flag: "w" });
  return { created, generated };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadRuntimeEnv() {
  delete process.env.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED;
  applyMap(parseEnvFile(".env.local"), { inherit: true });
  applyMap(parseEnvFile(".env.development.local"), { inherit: true });
  applyMap(parseEnvFile(SANDBOX_ENV_PATH), { inherit: false });
}

function assertIsolatedPreview() {
  const continuumEnv = process.env.CONTINUUM_ENV?.trim();
  const url = process.env.SUPABASE_URL?.trim();
  const previewRef = process.env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF?.trim();
  const productionRef =
    process.env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF?.trim() ??
    PRODUCTION_REF;
  const currentRef = url ? supabaseHostRef(url) : null;

  if (continuumEnv !== "preview") {
    fail("[continuum-preview] CONTINUUM_ENV must be preview.");
  }
  if (previewRef !== PREVIEW_REF) {
    fail("[continuum-preview] Preview ref does not match the sandbox project.");
  }
  if (productionRef !== PRODUCTION_REF) {
    fail("[continuum-preview] Production ref allowlist is not the forbidden Production project.");
  }
  if (!currentRef) {
    fail("[continuum-preview] SUPABASE_URL is missing or not a Supabase project URL.");
  }
  if (currentRef === PRODUCTION_REF) {
    fail("[continuum-preview] Refusing to start: SUPABASE_URL points at Production.");
  }
  if (currentRef !== PREVIEW_REF) {
    fail("[continuum-preview] SUPABASE_URL does not match the Preview sandbox project.");
  }
  const incremental = process.env.CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED?.trim();
  if (
    envPresent(incremental) &&
    incremental !== "true" &&
    incremental !== "1"
  ) {
    fail(
      "[continuum-preview] CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED must be true, 1, or unset.",
    );
  }
}

function assertSandboxServiceRole() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!envPresent(key)) {
    console.error(`
BLOCK: Preview service-role key is not set.

Obtain it locally (do not paste into Cursor chat):
1. Open Supabase → Continuum Preview → Settings → API
   https://supabase.com/dashboard/project/${PREVIEW_REF}/settings/api
2. Copy the service_role secret for project ${PREVIEW_REF} only.
3. Paste it into ${SANDBOX_ENV_PATH} as SUPABASE_SERVICE_ROLE_KEY=
4. Re-run: npm run assert:continuum-preview

Do not use the Production project ${PRODUCTION_REF}.
Do not reuse a Production service-role key.
`);
    process.exit(2);
  }

  const payload = decodeJwtPayload(key);
  const ref = typeof payload?.ref === "string" ? payload.ref.toLowerCase() : null;
  const role = typeof payload?.role === "string" ? payload.role : null;
  if (!ref || !role) {
    fail(
      "[continuum-preview] SUPABASE_SERVICE_ROLE_KEY is not a recognizable Supabase JWT. No value printed.",
    );
  }
  if (ref === PRODUCTION_REF) {
    fail(
      "[continuum-preview] Refusing to start: service-role key belongs to Production.",
    );
  }
  if (ref !== PREVIEW_REF) {
    fail(
      "[continuum-preview] service-role key project ref does not match the Preview sandbox.",
    );
  }
  if (role !== "service_role") {
    fail("[continuum-preview] Key role is not service_role.");
  }
}

function reportOauthReadiness() {
  const clientId = envPresent(process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_ID);
  const clientSecret = envPresent(process.env.CONTINUUM_GMAIL_OAUTH_CLIENT_SECRET);
  const redirect = process.env.CONTINUUM_GMAIL_OAUTH_REDIRECT_URI?.trim();
  const kek = envPresent(process.env.CONTINUUM_GMAIL_TOKEN_KEK);
  const founder = process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL?.trim();
  console.info(
    JSON.stringify(
      {
        gmailOAuthClientIdPresent: clientId,
        gmailOAuthClientSecretPresent: clientSecret,
        gmailOAuthRedirectLocalhost: redirect === LOCAL_GMAIL_REDIRECT,
        sandboxKekPresent: kek,
        founderMailboxConfigured: founder === SANDBOX_MAILBOX,
      },
      null,
      2,
    ),
  );
  if (!clientId || !clientSecret) {
    console.error(`
Gmail OAuth client is not in ${SANDBOX_ENV_PATH} yet.
Copy the existing Continuum Gmail OAuth CLIENT ID and CLIENT SECRET into that file.
Do not paste them into Cursor chat.
Do not change Production Google OAuth redirect URIs.
Localhost callback already expected:
${LOCAL_GMAIL_REDIRECT}
`);
    return false;
  }
  return true;
}

function runIsolationAssert() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "npx tsx scripts/continuum-preview-isolation-assert.ts",
      {
        stdio: "inherit",
        env: process.env,
        cwd: process.cwd(),
        shell: true,
      },
    );
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`isolation-assert exited ${code}`));
    });
  });
}

function startNextDev() {
  const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev"], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

const assertOnly = process.argv.includes("--assert-only");
const ensured = ensureSandboxEnvFile();
if (ensured.created) {
  console.info(`[continuum-preview] created ${SANDBOX_ENV_PATH}`);
}
if (ensured.generated.length) {
  console.info(
    `[continuum-preview] generated local-only secrets: ${ensured.generated.join(", ")}`,
  );
}

loadRuntimeEnv();
assertIsolatedPreview();
await runIsolationAssert();

reportOauthReadiness();
const hasServiceRole = envPresent(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (assertOnly && !hasServiceRole) {
  console.info(
    "[continuum-preview] isolation assertion passed. Service-role key still required before starting the app.",
  );
  process.exit(0);
}

assertSandboxServiceRole();
if (assertOnly) {
  console.info("[continuum-preview] sandbox runtime env is complete.");
  process.exit(0);
}

startNextDev();
