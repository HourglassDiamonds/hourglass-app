/**
 * Safe HubSpot read-scope probe — never prints tokens or raw emails.
 * Usage: npx tsx scripts/probe-hubspot-client-attention-reads.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      // Never overwrite a non-empty process env with an empty pull value.
      if (!process.env[k]?.trim() && v) process.env[k] = v;
    }
  } catch {
    // ignore
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

function redact(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/pat-[a-zA-Z0-9-]+/gi, "[token]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 400);
}

async function probe(token: string, path: string) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as {
      scopes?: string[];
      user?: string;
      results?: unknown[];
      total?: number;
    };
    return {
      path: path.split("?")[0],
      status: res.status,
      ok: res.ok,
      resultCount: Array.isArray(json.results) ? json.results.length : undefined,
      total: json.total,
      scopes: json.scopes?.filter((s) =>
        /crm\.objects\.(contacts|deals|tasks)/.test(s),
      ),
      allCrmScopes: json.scopes?.filter((s) => s.includes("crm.")),
      user: json.user ? "[redacted-user]" : undefined,
      bodyPreview: redact(text),
    };
  } catch {
    return {
      path: path.split("?")[0],
      status: res.status,
      ok: res.ok,
      bodyPreview: redact(text),
    };
  }
}

async function main() {
  const token = (
    process.env.HUBSPOT_ACCESS_TOKEN ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
    ""
  ).trim();
  const source = process.env.HUBSPOT_ACCESS_TOKEN?.trim()
    ? "HUBSPOT_ACCESS_TOKEN"
    : process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim()
      ? "HUBSPOT_PRIVATE_APP_TOKEN"
      : null;

  console.log(
    JSON.stringify(
      {
        hasToken: Boolean(token),
        tokenSource: source,
        tokenKind: token.startsWith("pat-")
          ? "private-app-pat"
          : token
            ? "other"
            : null,
      },
      null,
      2,
    ),
  );

  if (!token) {
    process.exit(1);
  }

  const contactProps =
    "email,firstname,lastname,phone,lifecyclestage,hs_lead_status,notes_last_contacted,notes_next_activity_date,hubspot_owner_id,preferred_contact_method";
  const dealProps =
    "dealname,dealstage,pipeline,amount,closedate,createdate,hs_lastmodifieddate,hubspot_owner_id,description,notes_last_updated";

  const results = [
    await probe(
      token,
      `/crm/v3/objects/contacts?limit=2&properties=${encodeURIComponent(contactProps)}`,
    ),
    await probe(
      token,
      `/crm/v3/objects/deals?limit=2&properties=${encodeURIComponent(dealProps)}`,
    ),
    await probe(
      token,
      `/crm/v3/objects/tasks?limit=2&properties=${encodeURIComponent("hs_task_subject,hs_task_status,hs_timestamp,hs_task_completion_date")}`,
    ),
    await probe(token, `/oauth/v1/access-tokens/${encodeURIComponent(token)}`),
  ];

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      error: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? redact(err.message) : "unknown",
    }),
  );
  process.exit(1);
});
