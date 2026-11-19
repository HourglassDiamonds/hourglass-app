import { expect, test } from "playwright/test";
import { createHmac, generateKeyPairSync, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

const LOGIN_PATH = "/executive-dashboard/staging-login";
const REVIEW_PATH =
  "/executive-dashboard/concierge/sterling-today/operational-review";
const BEGIN_PATH =
  "/api/continuum/production-shadow-founder-auth/passkey/begin";
const COMPLETE_PATH =
  "/api/continuum/production-shadow-founder-auth/passkey/complete";
const SESSION_COOKIE = "hgd_ed_session";
const USERNAME = "synthetic-founder";
const SESSION_SECRET = "synthetic-passkey-browser-session-secret-32-bytes";
const FOUNDER_USER_ID = "8f3c1d2e-9a70-4b5e-8c11-00c0711aa001";

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function syntheticSessionToken(nowMs = Date.now()): string {
  const body = base64UrlJson({
    v: 1,
    u: USERNAME,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + 60 * 60,
    sid: randomBytes(32).toString("base64url"),
  });
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function coseEs256PublicKey(x: Uint8Array, y: Uint8Array): Buffer {
  // COSE_Key: { 1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y }
  return Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01]),
    Buffer.from([0x21, 0x58, 0x20]),
    Buffer.from(x),
    Buffer.from([0x22, 0x58, 0x20]),
    Buffer.from(y),
  ]);
}

async function availablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("port-unavailable"));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("next-start-exited");
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server is not accepting connections yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("next-start-timeout");
}

test("ordinary founder passkey continues through session refresh", async ({
  browserName,
  playwright,
}) => {
  test.skip(browserName !== "chromium", "WebAuthn CDP requires Chromium");
  test.setTimeout(90_000);

  const credentialIdBytes = randomBytes(32);
  const credentialId = credentialIdBytes.toString("base64url");
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });
  const publicJwk = publicKey.export({ format: "jwk" });
  if (!publicJwk.x || !publicJwk.y) throw new Error("public-key-unavailable");
  const cosePublicKey = coseEs256PublicKey(
    Buffer.from(publicJwk.x, "base64url"),
    Buffer.from(publicJwk.y, "base64url"),
  );

  const port = await availablePort();
  const origin = `http://localhost:${port}`;
  const env = { ...process.env };
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  delete env.EXECUTIVE_DASHBOARD_PASSWORD_HASH;
  Object.assign(env, {
    NODE_ENV: "production",
    CONTINUUM_ENV: "local",
    CONTINUUM_OPERATIONAL_SHADOW_BROWSER_E2E: "1",
    CONTINUUM_WEBAUTHN_ORIGIN: origin,
    CONTINUUM_WEBAUTHN_RP_ID: "localhost",
    CONTINUUM_PASSKEY_BROWSER_E2E_CREDENTIAL_ID: credentialId,
    CONTINUUM_PASSKEY_BROWSER_E2E_PUBLIC_KEY:
      cosePublicKey.toString("base64url"),
    EXECUTIVE_DASHBOARD_USERNAME: USERNAME,
    EXECUTIVE_DASHBOARD_SESSION_SECRET: SESSION_SECRET,
  });

  const next = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let serverOutput = "";
  next.stdout?.on("data", (chunk) => { serverOutput += String(chunk); });
  next.stderr?.on("data", (chunk) => { serverOutput += String(chunk); });

  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | null = null;
  try {
    await waitForServer(`${origin}${LOGIN_PATH}`, next);
    browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable", { enableUI: false });
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    await cdp.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: credentialIdBytes.toString("base64"),
        isResidentCredential: false,
        rpId: "localhost",
        privateKey: Buffer.from(privateKeyDer).toString("base64"),
        signCount: 0,
        userHandle: Buffer.from(FOUNDER_USER_ID, "utf8").toString("base64"),
      },
    });
    const seededCredentials = await cdp.send("WebAuthn.getCredentials", {
      authenticatorId,
    });
    expect(seededCredentials.credentials).toHaveLength(1);

    await page.goto(`${origin}${LOGIN_PATH}`);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.evaluate(() => {
      const original = navigator.credentials.get.bind(navigator.credentials);
      Object.defineProperty(navigator.credentials, "get", {
        configurable: true,
        value: async (...args: Parameters<CredentialsContainer["get"]>) => {
          try {
            return await original(...args);
          } catch (error) {
            const value = error instanceof Error
              ? `${error.name}:${error.message}`
              : String(error);
            console.error(`virtual-webauthn:${value}`);
            throw error;
          }
        },
      });
    });
    const beginResponse = page.waitForResponse((response) =>
      response.url().endsWith(BEGIN_PATH) && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Continue with founder passkey" }).click();
    const begin = await beginResponse;
    expect(begin.status()).toBe(200);
    const beginBody = await begin.json() as {
      ok: boolean;
      options?: { allowCredentials?: Array<{ id: string }> };
    };
    expect(beginBody.ok).toBe(true);
    expect(beginBody.options?.allowCredentials?.[0]?.id).toBe(credentialId);
    const complete = await Promise.race([
      page.waitForResponse((response) =>
        response.url().endsWith(COMPLETE_PATH) &&
        response.request().method() === "POST",
      ),
      page.getByRole("alert").filter({ hasText: "Unable to verify" })
        .waitFor({ state: "visible" })
        .then(() => {
          throw new Error(`browser-passkey-failed:${browserErrors.join("|")}`);
        }),
    ]);
    expect(complete.status()).toBe(200);
    const challengeSetCookie = (await begin.headersArray())
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value)
      .join("\n");
    expect(challengeSetCookie).toContain("Path=/");

    await page.waitForURL(`**${REVIEW_PATH}`);
    await expect(page.getByRole("heading", { name: "Operational v11 comparison" }))
      .toBeVisible();
    const session = (await context.cookies()).find((cookie) =>
      cookie.name === SESSION_COOKIE
    );
    expect(session?.path).toBe("/executive-dashboard");

    await page.reload();
    await expect(page).toHaveURL(`${origin}${REVIEW_PATH}`);
    await expect(page.getByRole("heading", { name: "Operational v11 comparison" }))
      .toBeVisible();
  } catch (error) {
    throw new Error(`${String(error)}\nnext output:\n${serverOutput}`);
  } finally {
    await browser?.close();
    next.kill("SIGTERM");
  }
});
