/** Exact, idempotent Production write for the two authorized November 20 founder directives. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { createSupabaseClientMemoryNoteWriter } from "../lib/continuum/client-memory/write/supabase";
import { recordSterlingFounderDirective } from "../lib/continuum/today-sterling/founder-directive";
import { loadSterlingFounderDirectives } from "../lib/continuum/today-sterling/founder-directive-load";
import { authorizedNovember20FounderDirectives } from
  "../lib/continuum/today-sterling/authorized-founder-updates-2026-11-20";

function loadEnvFile(path: string): void {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith("#")) continue;
      const split = text.indexOf("=");
      if (split < 1) continue;
      const key = text.slice(0, split).trim();
      let value = text.slice(split + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
      if (key.endsWith("_SUPABASE_URL") && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = value;
    }
  } catch {
    // Optional local credential file.
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`missing-${name}`);
  return value;
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), ".env.production.local"));
  loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.production.local"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const url = required("SUPABASE_URL");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error("refusing-non-production-client-memory-target");
  }
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || required("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const writer = createSupabaseClientMemoryNoteWriter(client);
  const directives = authorizedNovember20FounderDirectives();
  const writes = [];
  for (const directive of directives) {
    const result = await recordSterlingFounderDirective({ writer, directive });
    if (!result.ok) throw new Error(`founder-directive-write-failed:${directive.directiveId}:${result.reason}`);
    writes.push({ directiveId: directive.directiveId, noteId: result.noteId, status: result.status });
  }
  const loaded = await loadSterlingFounderDirectives(client);
  const readable = directives.map((directive) => {
    const match = loaded.find((row) => row.directiveId === directive.directiveId);
    return {
      directiveId: directive.directiveId,
      readable: Boolean(match),
      workUnitId: match?.workUnitId ?? null,
      projectId: match?.projectId ?? null,
      personId: match?.personId ?? null,
    };
  });
  if (readable.some((row) => !row.readable)) throw new Error("founder-directive-readback-failed");
  process.stdout.write(`${JSON.stringify({ targetProjectRef: CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF,
    writeCount: writes.length, writes, readable })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "founder-directive-write-failed"}\n`);
  process.exitCode = 1;
});
