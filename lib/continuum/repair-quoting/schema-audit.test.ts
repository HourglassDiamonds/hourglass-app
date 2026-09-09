import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Repair quote SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-repair-quotes.sql"),
    "utf8",
  );

  it("is unapplied, additive, and does not ship a price catalog", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /Does NOT ship a Geller\/Edge price catalog/);
    assert.match(sql, /create table if not exists public\.continuum_repair_quotes/);
    assert.match(sql, /create table if not exists public\.continuum_repair_quote_mutations/);
    assert.match(sql, /source_price_semantics text not null/);
    assert.match(sql, /gold_as_of_date date not null/);
    assert.match(sql, /gold_input_source text not null/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /default 2850|default 2\.5/i);
    assert.doesNotMatch(sql, /geller_catalog|blue_book_prices/i);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant delete/i);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
  });

  it("locks V1 types, shop-cost vs retail, and append-only mutations", () => {
    for (const type of [
      "sizing",
      "head_prong_replacement",
      "laser_work",
      "stone_reset",
      "platinum_labor",
      "fourteen_k_operation",
    ]) {
      assert.match(sql, new RegExp(`'${type}'`));
    }
    assert.match(sql, /'shop_cost'/);
    assert.match(sql, /'suggested_retail'/);
    assert.match(sql, /continuum_repair_quotes_retail_no_extra_markup/);
    assert.match(sql, /grant select, insert on table public\.continuum_repair_quote_mutations to service_role;/);
    assert.match(sql, /Issued quotes are never silently repriced/);
  });
});
