import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Client Memory custom/repair operating-layer SQL", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "lib/supabase/continuum-client-memory-custom-repair-layers.sql",
    ),
    "utf8",
  );
  const kindSql = readFileSync(
    resolve(process.cwd(), "lib/supabase/continuum-client-memory-project-kind.sql"),
    "utf8",
  );

  it("is unapplied, additive, and keeps one canonical Project profile", () => {
    assert.match(sql, /UNAPPLIED/);
    assert.match(sql, /DO NOT RUN AGAINST PRODUCTION/);
    assert.match(sql, /continuum_project_profiles remains the ONE current Project record/);
    assert.match(sql, /create table if not exists public\.continuum_project_custom_details/);
    assert.match(sql, /create table if not exists public\.continuum_project_repair_details/);
    assert.match(sql, /project_id uuid primary key/);
    assert.match(sql, /on delete restrict/);
    assert.match(sql, /design_brief text/);
    assert.match(sql, /design_requirements text/);
    assert.match(sql, /manufacturing_notes text/);
    assert.match(sql, /item_description text/);
    assert.match(sql, /requested_service text/);
    assert.match(sql, /condition_notes text/);
    assert.match(sql, /technical_notes text/);
    assert.match(sql, /created_at timestamptz not null default now\(\)/);
    assert.match(sql, /updated_at timestamptz not null default now\(\)/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /execute format/i);
    assert.doesNotMatch(sql, /insert into public\.continuum_project_custom_details[\s\S]*select project_id from/i);
    assert.doesNotMatch(sql, /insert into public\.continuum_project_repair_details[\s\S]*select project_id from/i);
    assert.doesNotMatch(sql, /continuum_person_profiles/);
    assert.doesNotMatch(sql, /continuum_person_facts/);
    assert.doesNotMatch(sql, /continuum_gmail_messages/);
    assert.doesNotMatch(sql, /continuum_attention_items/);
    assert.doesNotMatch(sql, /continuum_project_operating/);
    assert.doesNotMatch(sql, /position\s*\(\s*chr\s*\(\s*0\s*\)/);
    assert.doesNotMatch(sql, /continuum_project_open_jobs/);
  });

  it("extends revision field CHECK without removing prior fields", () => {
    assert.match(sql, /continuum_project_history_revisions_field_name_check/);
    for (const field of [
      "finger_size",
      "order_number",
      "cad_job_number",
      "metal",
      "center_stone",
      "diamond_supply_notes",
      "project_kind",
      "custom_design_brief",
      "custom_design_requirements",
      "custom_manufacturing_notes",
      "repair_item_description",
      "repair_requested_service",
      "repair_condition_notes",
      "repair_technical_notes",
    ]) {
      assert.match(sql, new RegExp(`'${field}'`));
    }
    assert.match(kindSql, /'project_kind'/);
  });

  it("kind-gates writes server-side and does not delete dormant rows", () => {
    assert.match(
      sql,
      /create or replace function public\.continuum_client_memory_correct_project_operating_detail\(/,
    );
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /for update/);
    assert.match(sql, /raise exception 'wrong-project-kind'/);
    assert.match(sql, /required_kind := 'custom_new_jewelry'/);
    assert.match(sql, /required_kind := 'repair_service'/);
    assert.match(sql, /profile_row\.project_kind is distinct from required_kind/);
    assert.match(sql, /insert into public\.continuum_project_history_revisions/);
    assert.match(sql, /on conflict \(project_id\) do update/);
    assert.doesNotMatch(sql, /delete from public\.continuum_project_custom_details/i);
    assert.doesNotMatch(sql, /delete from public\.continuum_project_repair_details/i);
    assert.doesNotMatch(sql, /set project_kind/);
  });

  it("is service-role only", () => {
    const signature =
      "public.continuum_client_memory_correct_project_operating_detail\\(uuid, uuid, uuid, text, text, timestamptz, text, text\\)";
    assert.match(sql, new RegExp(`revoke all on function ${signature} from public;`, "i"));
    assert.match(sql, new RegExp(`revoke all on function ${signature} from anon;`, "i"));
    assert.match(
      sql,
      new RegExp(`revoke all on function ${signature} from authenticated;`, "i"),
    );
    assert.match(
      sql,
      new RegExp(`grant execute on function ${signature} to service_role;`, "i"),
    );
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to anon/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function [^;]+ to public/i);
  });

  it("ships a production CREATE OR REPLACE that does not probe chr(0)", () => {
    const patch = readFileSync(
      resolve(
        process.cwd(),
        "lib/supabase/continuum-client-memory-operating-detail-nul-guard.sql",
      ),
      "utf8",
    );
    assert.match(patch, /UNAPPLIED/);
    assert.match(patch, /DO NOT RUN AGAINST PRODUCTION/);
    assert.doesNotMatch(patch, /create table/i);
    assert.doesNotMatch(patch, /drop table/i);
    assert.doesNotMatch(patch, /alter table/i);
    assert.doesNotMatch(patch, /position\s*\(\s*chr\s*\(\s*0\s*\)/);
    const marker =
      "create or replace function public.continuum_client_memory_correct_project_operating_detail";
    const from = sql.indexOf(marker);
    const patchFrom = patch.indexOf(marker);
    assert.ok(from >= 0 && patchFrom >= 0);
    assert.equal(patch.slice(patchFrom), sql.slice(from));
  });
});
