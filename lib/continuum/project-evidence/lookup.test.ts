import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { discoverProjectEvidence, strictProjectNumbers } from "./discover";
import { PROJECT_EVIDENCE_THREAD_LOOKUP_RPC } from "./types";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/** Mirrors continuum_gmail_attachment_project_numbers(text). */
function attachmentProjectNumberTokens(filename: string): string[] {
  const normalized = filename.toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  return [...new Set(normalized.match(/\b(C[0-9]{5,}|SP[0-9]{4,}|RN[0-9]{4,})\b/g) ?? [])];
}

function executableStatements(sql: string): string[] {
  const withoutComments = sql
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("project evidence lookup", () => {
  const lookupSql = read("lib/supabase/continuum-gmail-attachment-project-numbers.sql");
  const indexSql = read("lib/supabase/continuum-gmail-attachment-project-numbers-index.sql");
  const indexCheckSql = read("lib/supabase/continuum-gmail-attachment-project-numbers-index-check.sql");
  const associationSql = read("lib/supabase/continuum-project-evidence-associations-schema.sql");
  const loader = read("lib/continuum/project-evidence/load.ts");

  it("finds a qualifying thread from an exact project number, not from subject or display name", () => {
    const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const found = discoverProjectEvidence({
      project: {
        projectId,
        label: "J.Pennock",
        cadJobNumber: "C025519",
        orderNumber: null,
        storedThreadId: null,
        matchJudgment: null,
        distrust: false,
        linkedPersonLabels: [],
      },
      catalog: [],
      threads: [
        {
          threadId: "19fd370bc47c5e1f",
          subjects: ["RE: HGD- J.Pennock-C025519"],
          attachmentFilenames: ["NL-H017-J.Pennock-C025519-Mod1.jpg"],
          earliest: "2026-09-01T12:00:00.000Z",
          latest: "2026-09-02T12:00:00.000Z",
        },
      ],
    });
    assert.equal(found[0]?.status, "candidate");
    assert.equal(found[0]?.sourceIdentity, "19fd370bc47c5e1f");

    const subjectOnly = discoverProjectEvidence({
      project: {
        projectId,
        label: "F. Grant",
        cadJobNumber: "C025885",
        orderNumber: null,
        storedThreadId: null,
        matchJudgment: null,
        distrust: false,
        linkedPersonLabels: [],
      },
      catalog: [],
      threads: [
        {
          threadId: "1a0ca7810946b8fe",
          subjects: ["RE: HGD x F.Grant-C025885-SP13477"],
          attachmentFilenames: [],
          earliest: null,
          latest: null,
        },
      ],
    });
    assert.deepEqual(subjectOnly, []);

    const nameOnly = discoverProjectEvidence({
      project: {
        projectId,
        label: "Dylon",
        cadJobNumber: "C025610",
        orderNumber: null,
        storedThreadId: null,
        matchJudgment: null,
        distrust: false,
        linkedPersonLabels: ["Dylon"],
      },
      catalog: [],
      threads: [
        {
          threadId: "19fed961d1371aaf",
          subjects: ["Hello Dylon"],
          attachmentFilenames: ["Dylon-portrait.jpg"],
          earliest: null,
          latest: null,
        },
      ],
    });
    assert.deepEqual(nameOnly, []);
    assert.match(loader, /client\.rpc\(PROJECT_EVIDENCE_THREAD_LOOKUP_RPC/);
    assert.doesNotMatch(loader, /\.ilike\(/);
    const types = read("lib/continuum/project-evidence/types.ts");
    assert.match(types, new RegExp(PROJECT_EVIDENCE_THREAD_LOOKUP_RPC));
    assert.match(lookupSql, /\\m\(C\[0-9\]\{5,\}/);
    assert.match(lookupSql, /upper\(coalesce\(p_filename/);
    assert.match(lookupSql, /@>/);
    assert.doesNotMatch(executableStatements(lookupSql).join("\n"), /create index/i);
    assert.match(lookupSql, /revoke all on function public\.continuum_gmail_thread_ids_for_project_number\(text\) from authenticated;/);
    assert.match(lookupSql, /grant execute on function public\.continuum_gmail_thread_ids_for_project_number\(text\) to service_role;/);
    assert.doesNotMatch(lookupSql, /grant execute .* to anon|grant execute .* to authenticated|grant execute .* to public/i);
  });

  it("keeps exact tokens and rejects alphanumeric substrings", () => {
    const cases: { filename: string; tokens: string[] }[] = [
      { filename: "NL-H017-J.Pennock-C025519-Mod1.jpg", tokens: ["C025519"] },
      { filename: "NL-H017-Dylon D-C025610-Mod4.stl", tokens: ["C025610"] },
      { filename: "F.Grant C025885 SP13477.pdf", tokens: ["C025885", "SP13477"] },
      { filename: "Duane_C026350.jpg", tokens: ["C026350"] },
      { filename: "Tim-Jenn-C025964.stl", tokens: ["C025964"] },
      { filename: "Nathan-C026176.png", tokens: ["C026176"] },
      { filename: "order-SP13477.pdf", tokens: ["SP13477"] },
      { filename: "stone RN08318.jpg", tokens: ["RN08318"] },
      { filename: "c025519-mod.jpg", tokens: ["C025519"] },
      { filename: "file (C025519).jpg", tokens: ["C025519"] },
      { filename: "C025519_Mod2.jpg", tokens: ["C025519"] },
      { filename: "ABC025519XYZ.jpg", tokens: [] },
      { filename: "XC025519.jpg", tokens: [] },
      { filename: "C0255192.jpg", tokens: ["C0255192"] },
      { filename: "SP13477X.pdf", tokens: [] },
    ];
    for (const item of cases) {
      assert.deepEqual(attachmentProjectNumberTokens(item.filename), item.tokens);
      assert.deepEqual(strictProjectNumbers(item.filename), item.tokens);
    }
    assert.equal(attachmentProjectNumberTokens("C0255192.jpg").includes("C025519"), false);
  });

  it("keeps the concurrent index in its own statement", () => {
    assert.match(indexSql, /UNAPPLIED/);
    assert.deepEqual(executableStatements(indexSql), [
      "create index concurrently continuum_gmail_attachments_project_numbers_idx\n  on public.continuum_gmail_attachments\n  using gin (public.continuum_gmail_attachment_project_numbers(filename))",
    ]);
    assert.doesNotMatch(indexSql, /create function|create table|begin;|commit;/i);
    const checkStatements = executableStatements(indexCheckSql).join("\n");
    assert.match(indexCheckSql, /indisvalid/);
    assert.match(indexCheckSql, /indisready/);
    assert.match(indexCheckSql, /pg_stat_progress_create_index/);
    assert.match(indexCheckSql, /latest_attachment_indexed_at/);
    assert.doesNotMatch(checkStatements, /\b(insert|update|delete|drop|create|alter)\b/i);
    assert.doesNotMatch(checkStatements, /\bfilename\b|bytea/i);
  });

  it("keeps the lookup migration additive and off Today and the Gmail writer", () => {
    assert.match(lookupSql, /UNAPPLIED/);
    assert.match(indexSql, /using gin/);
    assert.doesNotMatch(lookupSql, /gin_trgm|to_tsvector|websearch/i);
    assert.doesNotMatch(indexSql, /gin_trgm|to_tsvector|websearch/i);
    assert.doesNotMatch(lookupSql, /update public\.continuum_gmail_/i);
    assert.doesNotMatch(lookupSql, /drop table|drop column/i);
    assert.doesNotMatch(associationSql, /drop table public\.continuum_gmail|alter table public\.continuum_gmail/i);
    const surfaces = [
      "lib/continuum/gmail/supabase.ts",
      "lib/continuum/chief-of-staff/operating-loop/load.ts",
      "lib/continuum/source-events/gmail.ts",
    ];
    for (const path of surfaces) {
      const source = read(path);
      assert.doesNotMatch(source, /continuum_project_evidence_associations/);
      assert.doesNotMatch(source, /continuum_gmail_thread_ids_for_project_number/);
      assert.doesNotMatch(source, /continuum_gmail_attachment_project_numbers/);
    }
  });
});
