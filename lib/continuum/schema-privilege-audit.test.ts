import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();

type PrivilegeTable = {
  table: string;
  file: string;
  rlsPattern: RegExp;
};

const TABLES: PrivilegeTable[] = [
  {
    table: "continuum_entities",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern: /alter table continuum_entities enable row level security;/,
  },
  {
    table: "continuum_external_identities",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern:
      /alter table continuum_external_identities enable row level security;/,
  },
  {
    table: "continuum_events",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern: /alter table continuum_events enable row level security;/,
  },
  {
    table: "continuum_evidence",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern: /alter table continuum_evidence enable row level security;/,
  },
  {
    table: "continuum_observations",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern: /alter table continuum_observations enable row level security;/,
  },
  {
    table: "continuum_observation_evidence",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern:
      /alter table continuum_observation_evidence enable row level security;/,
  },
  {
    table: "continuum_exceptions",
    file: "lib/supabase/continuum-schema.sql",
    rlsPattern: /alter table continuum_exceptions enable row level security;/,
  },
  {
    table: "continuum_person_profiles",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern:
      /alter table continuum_person_profiles enable row level security;/,
  },
  {
    table: "continuum_relationships",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern:
      /alter table continuum_relationships enable row level security;/,
  },
  {
    table: "continuum_person_facts",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern: /alter table continuum_person_facts enable row level security;/,
  },
  {
    table: "continuum_source_notes",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern: /alter table continuum_source_notes enable row level security;/,
  },
  {
    table: "continuum_wishes",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern: /alter table continuum_wishes enable row level security;/,
  },
  {
    table: "continuum_project_profiles",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern:
      /alter table continuum_project_profiles enable row level security;/,
  },
  {
    table: "continuum_project_history",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern:
      /alter table continuum_project_history enable row level security;/,
  },
  {
    table: "continuum_identity_reviews",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern:
      /alter table continuum_identity_reviews enable row level security;/,
  },
  {
    table: "continuum_fact_evidence",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern: /alter table continuum_fact_evidence enable row level security;/,
  },
  {
    table: "continuum_wish_evidence",
    file: "lib/supabase/continuum-client-memory-schema.sql",
    rlsPattern: /alter table continuum_wish_evidence enable row level security;/,
  },
  {
    table: "continuum_source_note_revisions",
    file: "lib/supabase/continuum-client-memory-source-note-lifecycle.sql",
    rlsPattern:
      /alter table public\.continuum_source_note_revisions enable row level security;/,
  },
  {
    table: "continuum_project_history_revisions",
    file: "lib/supabase/continuum-client-memory-correct-project-spec.sql",
    rlsPattern:
      /alter table public\.continuum_project_history_revisions enable row level security;/,
  },
  {
    table: "continuum_project_custom_details",
    file: "lib/supabase/continuum-client-memory-custom-repair-layers.sql",
    rlsPattern:
      /alter table public\.continuum_project_custom_details enable row level security;/,
  },
  {
    table: "continuum_project_repair_details",
    file: "lib/supabase/continuum-client-memory-custom-repair-layers.sql",
    rlsPattern:
      /alter table public\.continuum_project_repair_details enable row level security;/,
  },
  {
    table: "continuum_project_lifecycle_states",
    file: "lib/supabase/continuum-client-memory-project-lifecycle.sql",
    rlsPattern:
      /alter table public\.continuum_project_lifecycle_states enable row level security;/,
  },
  {
    table: "continuum_project_lifecycle_events",
    file: "lib/supabase/continuum-client-memory-project-lifecycle.sql",
    rlsPattern:
      /alter table public\.continuum_project_lifecycle_events enable row level security;/,
  },
];

const EXCLUDED = [
  "agent_os_persisted_state",
  "agent_os_delivery_claims",
] as const;

const CANONICAL_FILES = [...new Set(TABLES.map((entry) => entry.file))];

const sqlByFile = new Map(
  CANONICAL_FILES.map((file) => [
    file,
    readFileSync(resolve(ROOT, file), "utf8"),
  ]),
);

function privilegeBlock(table: string): string[] {
  return [
    `revoke all on table public.${table} from public;`,
    `revoke all on table public.${table} from anon;`,
    `revoke all on table public.${table} from authenticated;`,
    `grant all on table public.${table} to service_role;`,
  ];
}

function walkSourceFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === ".git" ||
      name === "coverage"
    ) {
      continue;
    }
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(name)) continue;
    if (/\.test\.(ts|tsx|js|mjs)$/.test(name)) continue;
    out.push(full);
  }
}

describe("Older Continuum table privilege contract", () => {
  it("covers exactly the 23 Pass 6 tables and not the excluded agent_os tables", () => {
    assert.equal(TABLES.length, 23);
    const names = TABLES.map((entry) => entry.table);
    assert.equal(new Set(names).size, 23);
    for (const excluded of EXCLUDED) {
      assert.equal(names.includes(excluded), false);
    }
    for (const sql of sqlByFile.values()) {
      for (const excluded of EXCLUDED) {
        assert.equal(sql.includes(excluded), false);
      }
      assert.doesNotMatch(sql, /create policy/i);
      assert.doesNotMatch(sql, /disable row level security/i);
      assert.doesNotMatch(sql, /tenant_id/);
      assert.doesNotMatch(sql, /nextval\(/i);
      assert.doesNotMatch(sql, /\bserial\b/i);
      assert.doesNotMatch(sql, /generated always as identity/i);
      assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+anon\b/im);
      assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+authenticated\b/im);
      assert.doesNotMatch(sql, /^\s*grant\b[^;]*\bto\s+public\b/im);
    }
  });

  it("locks RLS-on, no policies, and the explicit service-role privilege contract", () => {
    for (const entry of TABLES) {
      const sql = sqlByFile.get(entry.file);
      assert.ok(sql, entry.file);
      assert.match(sql, entry.rlsPattern);
      for (const statement of privilegeBlock(entry.table)) {
        assert.equal(
          sql.includes(statement),
          true,
          `${entry.table}: missing ${statement}`,
        );
      }
    }
  });

  it("keeps table access server-side service_role only", () => {
    const adminClient = readFileSync(
      resolve(ROOT, "lib/supabase/client.ts"),
      "utf8",
    );
    assert.match(adminClient, /SERVER ONLY/);
    assert.match(adminClient, /never NEXT_PUBLIC_\*/);
    assert.match(adminClient, /supabaseServiceRoleKey/);
    assert.doesNotMatch(adminClient, /NEXT_PUBLIC_SUPABASE/);
    assert.doesNotMatch(adminClient, /createBrowserClient/);
    assert.doesNotMatch(adminClient, /SUPABASE_ANON/);

    const files: string[] = [];
    walkSourceFiles(join(ROOT, "app"), files);
    walkSourceFiles(join(ROOT, "lib"), files);
    walkSourceFiles(join(ROOT, "scripts"), files);

    const tableNames = TABLES.map((entry) => entry.table);
    const fromPattern = new RegExp(
      `\\.from\\(["'](${tableNames.join("|")})["']\\)`,
    );
    const browserMarkers =
      /createBrowserClient|createClientComponentClient|NEXT_PUBLIC_SUPABASE/;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!fromPattern.test(source)) continue;
      const relative = file.slice(ROOT.length + 1).replaceAll("\\", "/");
      assert.match(
        relative,
        /^(lib\/continuum\/|scripts\/continuum-)/,
        `${relative} queries a Pass 6 table outside server Continuum modules`,
      );
      assert.doesNotMatch(
        source,
        browserMarkers,
        `${relative} uses a browser/public Supabase path for a Pass 6 table`,
      );
      assert.doesNotMatch(
        source,
        /^["']use client["']/m,
        `${relative} is a client module querying a Pass 6 table`,
      );
    }
  });
});
