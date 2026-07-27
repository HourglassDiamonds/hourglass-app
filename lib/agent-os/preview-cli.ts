/**
 * Local preview CLI helpers for Agent OS founder briefs.
 * Used by scripts/agent-os-brief.ts only — never by Vercel runtime.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BriefCadenceIntent } from "./brief-quality";

/**
 * Load `.env.local` for local CLI only.
 * Precedence: already-set process/shell env wins; `.env.local` fills gaps only.
 * Never prints values. Does not create env files or pull Vercel secrets.
 */
export function loadEnvLocalForPreview(cwd = process.cwd()): {
  loaded: boolean;
  keysApplied: number;
} {
  try {
    const raw = readFileSync(resolve(cwd, ".env.local"), "utf8");
    let keysApplied = 0;
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      if (!key) continue;
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
        keysApplied += 1;
      }
    }
    return { loaded: true, keysApplied };
  } catch {
    return { loaded: false, keysApplied: 0 };
  }
}

/**
 * Parse explicit cadence intent from CLI args.
 * Direct preview defaults to daily — never silently weekly.
 */
export function parseBriefCadenceIntent(args: string[]): BriefCadenceIntent {
  if (args.includes("--daily") || args.includes("--cadence=daily")) {
    return "daily";
  }
  if (args.includes("--weekly") || args.includes("--cadence=weekly")) {
    return "weekly";
  }
  const cadenceArg = args.find((a) => a.startsWith("--cadence="));
  if (cadenceArg) {
    const v = cadenceArg.slice("--cadence=".length).toLowerCase();
    if (v === "daily" || v === "weekly") return v;
    throw new Error(`Invalid --cadence=${v}; use daily or weekly`);
  }
  return "daily";
}
