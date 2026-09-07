import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Human intake reMarkable SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-human-intake-remarkable.sql"),
    "utf8",
  );

  it("is unapplied and additive", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /add column if not exists original_filename/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /drop column/i);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_open_jobs/);
    assert.doesNotMatch(sql, /create table if not exists public\.continuum_commitments/);
    assert.match(sql, /Does not add OCR/);
    assert.doesNotMatch(sql, /tesseract/i);
  });
});
