import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprintWorkbook } from "./artifact";
import { runClientMemoryImport } from "./import-runtime";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  personCells,
} from "./synthetic-xlsx";

describe("Client Memory apply adapter gates", () => {
  it("does not load the Supabase persistence module before fingerprint and flags succeed", async () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [personCells({ name: "Ada Lovelace", email: "ada@example.com" })],
      }),
    );
    const workbookPath = "synthetic-client-memory.xlsx";

    async function assertLoaderIdle(args: string[], env: NodeJS.ProcessEnv) {
      let loaded = 0;
      await runClientMemoryImport(args, {
        cwd: process.cwd(),
        env,
        workbookExists: () => true,
        readWorkbook: () => xlsx,
        loadSupabaseStore: async () => {
          loaded += 1;
          throw new Error("supabase-adapter-should-not-load");
        },
      });
      assert.equal(loaded, 0);
    }

    await assertLoaderIdle(
      ["--apply", "--target=supabase", `--workbook=${workbookPath}`],
      { ...process.env, CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "true" },
    );
    await assertLoaderIdle(
      [
        "--apply",
        "--target=supabase",
        "--confirm-production-client-import",
        `--workbook=${workbookPath}`,
      ],
      { ...process.env, CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "" },
    );
    await assertLoaderIdle([`--workbook=${workbookPath}`], {
      ...process.env,
      CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "true",
    });
    await assertLoaderIdle(
      [
        "--apply",
        "--target=memory",
        "--confirm-production-client-import",
        `--workbook=${workbookPath}`,
      ],
      { ...process.env, CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "true" },
    );
    await assertLoaderIdle(
      [
        "--apply",
        "--target=supabase",
        "--confirm-production-client-import",
        `--workbook=${workbookPath}`,
      ],
      { ...process.env, CONTINUUM_CLIENT_MEMORY_IMPORT_ENABLED: "true" },
    );

    assert.notEqual(fingerprintWorkbook(xlsx), "e".repeat(64));
  });
});
