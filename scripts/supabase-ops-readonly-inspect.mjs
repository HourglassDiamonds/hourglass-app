/**
 * READ-ONLY Supabase operational inspection (fetch-only, no local deps).
 *
 * WARNING: Do not extend this script with INSERT/UPDATE/DELETE, storage uploads,
 * object listing by name, or any mutative Admin API calls.
 *
 * Requires env (never commit values):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Outputs aggregates + configuration metadata only.
 * Never prints secrets, row IDs, paths, filenames, OCR, report numbers, or URLs.
 *
 * Usage (set the two env vars in the shell or via a gitignored env file):
 *   node scripts/supabase-ops-readonly-inspect.mjs
 */
function present(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.host, protocol: u.protocol };
  } catch {
    return { host: null, protocol: null };
  }
}

function keyMeta(key) {
  if (!key) return { present: false };
  const trimmed = key.trim();
  return {
    present: true,
    lengthBucket:
      trimmed.length < 20
        ? "lt20"
        : trimmed.length < 40
          ? "20-39"
          : trimmed.length < 80
            ? "40-79"
            : trimmed.length < 200
              ? "80-199"
              : "200plus",
    looksLikeJwt: trimmed.startsWith("eyJ"),
    looksLikeSbSecret: /^sb_(secret|service_role)_/i.test(trimmed),
  };
}

function fail(msg, detail) {
  console.log(JSON.stringify({ ok: false, error: msg, detail }, null, 2));
  process.exitCode = 1;
}

function headers(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function restCount(url, key, table, query = "") {
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent("*")}${query ? `&${query}` : ""}`,
    {
      method: "HEAD",
      headers: {
        ...headers(key),
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  if (!res.ok && res.status !== 206) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: body.slice(0, 200) || res.statusText,
    };
  }
  const contentRange = res.headers.get("content-range");
  // content-range: 0-0/123 or */123
  const match = contentRange?.match(/\/(\d+|\*)/);
  const count =
    match && match[1] !== "*" ? Number(match[1]) : null;
  return { ok: true, count, contentRange };
}

async function probeColumn(url, key, table, column) {
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=0`,
    {
      method: "GET",
      headers: {
        ...headers(key),
        Prefer: "count=exact",
      },
    },
  );
  if (res.ok) return { present: true };
  let msg = "";
  try {
    msg = await res.text();
  } catch {
    msg = "";
  }
  const missing =
    /column|does not exist|Could not find/i.test(msg) || res.status === 400;
  return {
    present: missing ? false : "unknown",
    status: res.status,
    hint: missing ? "column_missing_or_inaccessible" : "probe_failed",
  };
}

async function listBuckets(url, key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/storage/v1/bucket`, {
    headers: headers(key),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: (await res.text()).slice(0, 200) };
  }
  const buckets = await res.json();
  return { ok: true, buckets };
}

async function fetchOpenApi(url, key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      ...headers(key),
      Accept: "application/openapi+json",
    },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const spec = await res.json();
  const paths = Object.keys(spec.paths ?? {});
  const tables = paths
    .filter((p) => p.startsWith("/") && !p.slice(1).includes("/"))
    .map((p) => p.slice(1))
    .filter(Boolean)
    .sort();
  const defs = spec.definitions ?? spec.components?.schemas ?? {};
  const schemaColumns = {};
  for (const name of [
    "diamond_intelligence_submissions",
    "shape_studio_sessions",
  ]) {
    const def = defs[name];
    if (def?.properties) {
      schemaColumns[name] = Object.keys(def.properties).sort();
    }
  }
  return { ok: true, tables, schemaColumns };
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const report = {
    ok: true,
    mode: "read_only_aggregates_fetch",
    generatedAt: new Date().toISOString(),
    env: {
      SUPABASE_URL: present("SUPABASE_URL")
        ? { present: true, ...redactUrl(url) }
        : { present: false },
      SUPABASE_SERVICE_ROLE_KEY: keyMeta(key),
    },
  };

  if (!url || !key) {
    fail("missing_supabase_env", report.env);
    return;
  }

  try {
    const health = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
    });
    report.authHealth = { httpStatus: health.status, ok: health.ok };
  } catch (e) {
    report.authHealth = {
      ok: false,
      error: e instanceof Error ? e.message : "health_fetch_failed",
    };
  }

  const openApi = await fetchOpenApi(url, key);
  report.openApi = openApi.ok
    ? {
        ok: true,
        tableCount: openApi.tables.length,
        relevantTablesPresent: {
          diamond_intelligence_submissions: openApi.tables.includes(
            "diamond_intelligence_submissions",
          ),
          shape_studio_sessions: openApi.tables.includes("shape_studio_sessions"),
        },
        schemaColumns: openApi.schemaColumns,
      }
    : { ok: false, status: openApi.status };

  const bucketResult = await listBuckets(url, key);
  if (!bucketResult.ok) {
    report.storage = bucketResult;
  } else {
    const buckets = bucketResult.buckets ?? [];
    const expected = [
      "diamond-intelligence-submissions",
      "shape-studio-captures",
    ];
    const relevant = buckets.filter((b) =>
      expected.includes(b.id || b.name),
    );
    report.storage = {
      ok: true,
      totalBucketCount: buckets.length,
      relevantBuckets: relevant.map((b) => ({
        id: b.id,
        name: b.name,
        public: b.public,
        fileSizeLimit: b.file_size_limit ?? null,
        allowedMimeTypes: b.allowed_mime_types ?? null,
        createdAt: b.created_at ?? null,
        updatedAt: b.updated_at ?? null,
      })),
      missingExpected: expected.filter(
        (name) => !buckets.some((b) => (b.id || b.name) === name),
      ),
    };
  }

  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const diCols = [
    "id",
    "created_at",
    "file_path",
    "metadata_retention_policy",
    "upload_expires_at",
    "ocr_text_expires_at",
    "source_type",
    "page_image_paths",
  ];
  const diColumnProbe = {};
  for (const col of diCols) {
    diColumnProbe[col] = await probeColumn(
      url,
      key,
      "diamond_intelligence_submissions",
      col,
    );
  }

  report.diamondIntelligence = {
    columns: diColumnProbe,
    counts: {
      total: await restCount(url, key, "diamond_intelligence_submissions"),
      olderThan30Days: await restCount(
        url,
        key,
        "diamond_intelligence_submissions",
        `created_at=lt.${cutoff30d}`,
      ),
      retentionIndefinite: await restCount(
        url,
        key,
        "diamond_intelligence_submissions",
        `metadata_retention_policy=eq.indefinite`,
      ),
      retention30Days: await restCount(
        url,
        key,
        "diamond_intelligence_submissions",
        `metadata_retention_policy=eq.30_days`,
      ),
      nullFilePath: await restCount(
        url,
        key,
        "diamond_intelligence_submissions",
        `file_path=is.null`,
      ),
      nonNullFilePath: await restCount(
        url,
        key,
        "diamond_intelligence_submissions",
        `file_path=not.is.null`,
      ),
    },
  };

  const ssCols = [
    "session_id",
    "status",
    "image_path",
    "image_mime",
    "created_at",
    "expires_at",
    "acknowledged_at",
  ];
  const ssColumnProbe = {};
  for (const col of ssCols) {
    ssColumnProbe[col] = await probeColumn(
      url,
      key,
      "shape_studio_sessions",
      col,
    );
  }

  report.shapeStudio = {
    columns: ssColumnProbe,
    counts: {
      total: await restCount(url, key, "shape_studio_sessions"),
      activePendingOrUploaded: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `status=in.(pending,image_uploaded)`,
      ),
      expiredStatus: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `status=eq.expired`,
      ),
      consumed: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `status=eq.consumed`,
      ),
      cancelled: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `status=eq.cancelled`,
      ),
      pastExpiresAt: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `expires_at=lt.${nowIso}`,
      ),
      olderThan24Hours: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `created_at=lt.${cutoff24h}`,
      ),
      activeButPastExpiry: await restCount(
        url,
        key,
        "shape_studio_sessions",
        `status=in.(pending,image_uploaded)&expires_at=lt.${nowIso}`,
      ),
    },
  };

  report.limitations = [
    "RLS enabled/disabled and policy definitions require SQL editor — not available via PostgREST alone.",
    "Column DEFAULT values require information_schema — not verified here.",
    "Index definitions require pg_indexes — not verified here.",
    "Storage object policies require SQL/Dashboard — not verified here.",
    "Object orphan counts require listing object names — intentionally not performed.",
    "Service-role key rotation history cannot be proven from this probe.",
  ];

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  fail("unhandled", e instanceof Error ? e.message : String(e));
});
