import { getSupabaseAdmin } from "../lib/supabase/client";
import { SHAPE_STUDIO_CAPTURES_BUCKET } from "../lib/shape-studio/sessions";

async function main() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.log("NO_SUPABASE");
    return;
  }
  const { data, error } = await sb.storage.createBucket(
    SHAPE_STUDIO_CAPTURES_BUCKET,
    { public: false },
  );
  console.log("createBucket:", error?.message ?? "ok", data);
}

main();
