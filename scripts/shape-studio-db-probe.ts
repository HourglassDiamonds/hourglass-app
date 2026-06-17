import { getSupabaseAdmin } from "../lib/supabase/client";

async function main() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.log("NO_SUPABASE");
    return;
  }

  const { data: buckets, error: bucketErr } = await sb.storage.listBuckets();
  console.log("buckets:", bucketErr?.message ?? "ok");
  for (const b of buckets ?? []) {
    console.log(`  ${b.name} (${b.public ? "public" : "private"})`);
  }

  const di = await sb
    .from("diamond_intelligence_submissions")
    .select("id")
    .limit(1);
  console.log("DI table:", di.error?.message ?? "ok");

  const shape = await sb.from("shape_studio_sessions").select("session_id").limit(1);
  console.log("shape_studio_sessions:", shape.error?.message ?? "ok");
}

main();
