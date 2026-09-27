import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { discoverProjectEvidence } from "./discover";
import { PROJECT_EVIDENCE_THREAD_LOOKUP_RPC } from "./types";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("project evidence lookup", () => {
  const lookupSql = read("lib/supabase/continuum-gmail-attachment-project-numbers.sql");
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
    assert.match(lookupSql, /@>/);
    assert.match(lookupSql, /revoke all on function public\.continuum_gmail_thread_ids_for_project_number\(text\) from authenticated;/);
    assert.match(lookupSql, /grant execute on function public\.continuum_gmail_thread_ids_for_project_number\(text\) to service_role;/);
    assert.doesNotMatch(lookupSql, /grant execute .* to anon|grant execute .* to authenticated|grant execute .* to public/i);
  });

  it("keeps the lookup migration additive and off Today and the Gmail writer", () => {
    assert.match(lookupSql, /UNAPPLIED/);
    assert.match(lookupSql, /using gin/);
    assert.doesNotMatch(lookupSql, /gin_trgm|to_tsvector|websearch/i);
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
