/**
 * Preview-only: strip founder login keys from Next dotenv files in-memory
 * so .env.continuum-preview.local values already on process.env win.
 * Loaded via node --require from scripts/continuum-preview-dev.mjs.
 * Does not print secrets. Does not write env files.
 */
const fs = require("fs");
const path = require("path");

const STRIP = new Set([
  "EXECUTIVE_DASHBOARD_USERNAME",
  "EXECUTIVE_DASHBOARD_PASSWORD_HASH",
]);
const FROM_NEXT_DOTENV = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
]);

const orig = fs.readFileSync;
fs.readFileSync = function (file, options) {
  const result = orig.apply(this, arguments);
  const base = path.basename(String(file));
  if (!FROM_NEXT_DOTENV.has(base)) return result;
  const asBuffer = Buffer.isBuffer(result);
  const text = asBuffer ? result.toString("utf8") : String(result);
  const filtered = text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return true;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return true;
      return !STRIP.has(trimmed.slice(0, eq).trim());
    })
    .join("\n");
  if (asBuffer) return Buffer.from(filtered);
  return filtered;
};
