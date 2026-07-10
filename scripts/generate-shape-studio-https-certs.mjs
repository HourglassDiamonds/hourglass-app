#!/usr/bin/env node
/**
 * Generate local HTTPS certs for Shape Studio mobile capture (mkcert).
 * Run: npm run certs:lan
 * Then: npm run dev:https
 *
 * iPhone: install %LOCALAPPDATA%\\mkcert\\rootCA.pem as a profile, then enable
 * full trust under Settings → General → About → Certificate Trust Settings.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir, networkInterfaces, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const certDir = join(projectRoot, ".cert");

function mkcertBinary() {
  if (platform() === "win32") {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
      "mkcert",
      "mkcert-v1.4.4-windows-amd64.exe",
    );
  }
  return "mkcert";
}

function detectLanIpv4() {
  const nets = Object.values(networkInterfaces()).flat();
  const match = nets.find(
    (net) =>
      net &&
      net.family === "IPv4" &&
      !net.internal &&
      !String(net.address).startsWith("169.254."),
  );
  return match?.address ?? null;
}

mkdirSync(certDir, { recursive: true });

const mkcert = mkcertBinary();
const lanIp = detectLanIpv4();

if (!lanIp) {
  console.error("Could not detect a LAN IPv4 address.");
  process.exit(1);
}

console.log(`Generating HTTPS cert for localhost and ${lanIp}…`);

try {
  execFileSync(mkcert, ["-install"], { stdio: "inherit" });
} catch {
  console.warn("mkcert -install failed or was skipped; continuing.");
}

const names = ["localhost", "127.0.0.1", lanIp, "::1"];
execFileSync(
  mkcert,
  [
    "-cert-file",
    join(certDir, "cert.pem"),
    "-key-file",
    join(certDir, "key.pem"),
    ...names,
  ],
  { stdio: "inherit" },
);

console.log(`\nCerts written to ${certDir}`);
console.log(`Set in .env.local:`);
console.log(`SHAPE_STUDIO_PUBLIC_ORIGIN=https://${lanIp}:3000`);
