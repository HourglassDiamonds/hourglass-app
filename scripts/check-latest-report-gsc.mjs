/**
 * Reads latest weekly_reports.raw_payload GSC + snapshot status (no secrets).
 * Usage: node scripts/check-latest-report-gsc.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const res = await fetch(
  `${url}/rest/v1/weekly_reports?select=id,week_start,week_end,created_at,raw_payload&order=created_at.desc&limit=1`,
  {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  },
);

if (!res.ok) {
  console.error("Supabase read failed:", res.status, await res.text());
  process.exit(1);
}

const [row] = await res.json();
if (!row) {
  console.log("No weekly reports found");
  process.exit(0);
}

const payload = row.raw_payload ?? {};
const gsc = payload.gsc;
const snap = payload.dashboardSnapshot;

console.log("Week:", row.week_start, "→", row.week_end);
console.log("gsc.status:", gsc?.status ?? "(missing)");
if (gsc?.unavailableReason) console.log("gsc.unavailableReason:", gsc.unavailableReason);
console.log(
  "dashboardSnapshot.sources.gsc:",
  snap?.sources?.gsc ?? "(no snapshot)",
);
console.log(
  "searchAuthority.status:",
  snap?.searchAuthority?.status ?? "(no snapshot)",
);
console.log("brandDemand.status:", snap?.brandDemand?.status ?? "(no snapshot)");

if (gsc?.status === "live" && gsc.current?.totals) {
  console.log(
    "GSC totals (current week):",
    `impressions=${gsc.current.totals.impressions}`,
    `clicks=${gsc.current.totals.clicks}`,
  );
}
