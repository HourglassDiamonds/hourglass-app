import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Repair quote SQL", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-repair-quotes.sql"),
    "utf8",
  );
  const hardening = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-repair-quotes-privilege-hardening.sql",
    ),
    "utf8",
  );

  it("records applied V1 schema without a price catalog", () => {
    assert.match(sql, /APPLIED TO PRODUCTION 2026-09-09/);
    assert.match(sql, /20260909190009 continuum_repair_quotes_v1/);
    assert.match(sql, /20260909190044 continuum_repair_quotes_v1_privilege_hardening/);
    assert.doesNotMatch(sql, /UNAPPLIED/);
    assert.match(sql, /Do not re-run against production/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /Does NOT create a live Geller\/Edge price catalog table/);
    assert.match(sql, /No catalog table/);
    assert.match(sql, /RLS enabled/);
    assert.match(sql, /Service-role-only application access/);
    assert.match(sql, /Geller Blue Book Version 5\.0 Release 6\.50/);
    assert.match(sql, /create table if not exists public\.continuum_repair_quotes/);
    assert.match(sql, /create table if not exists public\.continuum_repair_quote_mutations/);
    assert.match(sql, /source_sku text not null/);
    assert.match(sql, /roundedComputedQuoteEighthCents/);
    assert.match(sql, /metalPricing/);
    assert.match(sql, /hourglassMarkupNumerator/);
    assert.match(sql, /prior_hourglass_quote_eighth_cents/);
    assert.match(sql, /continuum_repair_quotes_protect_issued/);
    assert.match(sql, /issued-quote-immutable/);
    assert.match(sql, /alter table public\.continuum_repair_quotes enable row level security;/);
    assert.match(
      sql,
      /alter table public\.continuum_repair_quote_mutations enable row level security;/,
    );
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /default 2850|default 2\.5/i);
    assert.doesNotMatch(sql, /geller_catalog|blue_book_prices/);
    assert.doesNotMatch(sql, /grant .* to anon/i);
    assert.doesNotMatch(sql, /grant .* to authenticated/i);
    assert.doesNotMatch(sql, /grant .* to public/i);
    assert.doesNotMatch(sql, /grant delete/i);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /shop_cost|suggested_retail|source_price_semantics/);
  });

  it("locks V1 types, 2.5x cost snapshot, and append-only mutations", () => {
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
    assert.match(sql, /expressSelected/);
    assert.match(sql, /grant select, insert, update on table public\.continuum_repair_quotes to service_role;/);
    assert.match(sql, /grant select, insert on table public\.continuum_repair_quote_mutations to service_role;/);
    assert.match(sql, /Issued quotes are never silently repriced/);
    assert.match(sql, /Cost columns are the Hourglass basis/);
  });

  it("records privilege hardening already applied to production", () => {
    assert.match(hardening, /APPLIED TO PRODUCTION 2026-09-09/);
    assert.match(hardening, /20260909190044 continuum_repair_quotes_v1_privilege_hardening/);
    assert.match(hardening, /20260909190009/);
    assert.match(hardening, /Do not re-run against production/);
    assert.match(hardening, /No catalog table/);
    assert.match(hardening, /RLS remains enabled/);
    assert.match(hardening, /Service-role-only application access/);
    assert.doesNotMatch(hardening, /UNAPPLIED/);
    assert.doesNotMatch(hardening, /create table/i);
    assert.doesNotMatch(hardening, /alter table/i);
    assert.doesNotMatch(hardening, /drop /i);
    assert.doesNotMatch(hardening, /create policy/i);
    assert.doesNotMatch(hardening, /create or replace function/i);
    assert.doesNotMatch(hardening, /disable row level security/i);
    assert.doesNotMatch(hardening, /geller_catalog|blue_book_prices/);
    assert.doesNotMatch(hardening, /continuum_gmail_messages/);
    assert.doesNotMatch(hardening, /continuum_attention_items/);
    assert.doesNotMatch(hardening, /continuum_project_profiles/);
    assert.doesNotMatch(hardening, /hourglassMarkup|2\.5|2850/);
  });

  it("revokes public, anon, and authenticated and restores the service-role contract only", () => {
    assert.match(
      hardening,
      /REVOKE ALL ON TABLE\s+public\.continuum_repair_quotes\s+FROM public, anon, authenticated;/i,
    );
    assert.match(
      hardening,
      /REVOKE ALL ON TABLE\s+public\.continuum_repair_quote_mutations\s+FROM public, anon, authenticated;/i,
    );
    assert.match(
      hardening,
      /GRANT SELECT, INSERT, UPDATE ON TABLE\s+public\.continuum_repair_quotes\s+TO service_role;/i,
    );
    assert.match(
      hardening,
      /GRANT SELECT, INSERT ON TABLE\s+public\.continuum_repair_quote_mutations\s+TO service_role;/i,
    );
    assert.match(
      hardening,
      /REVOKE EXECUTE ON FUNCTION\s+public\.continuum_repair_quotes_protect_issued\(\)\s+FROM public, anon, authenticated;/i,
    );
    assert.match(
      hardening,
      /GRANT EXECUTE ON FUNCTION\s+public\.continuum_repair_quotes_protect_issued\(\)\s+TO service_role;/i,
    );
    assert.doesNotMatch(hardening, /grant .* to anon/i);
    assert.doesNotMatch(hardening, /grant .* to authenticated/i);
    assert.doesNotMatch(hardening, /grant .* to public/i);
    assert.doesNotMatch(hardening, /grant all/i);
    assert.doesNotMatch(hardening, /grant delete/i);
    assert.doesNotMatch(hardening, /grant update on table public\.continuum_repair_quote_mutations/i);
    assert.doesNotMatch(hardening, /grant execute .* to (?:anon|authenticated|public)/i);
  });
});
