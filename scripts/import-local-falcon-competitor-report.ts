import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { importLocalFalconCompetitorReport } from "@/lib/intelligence/review-velocity/local-falcon-import";

loadEnvConfig(process.cwd());

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: npm run intelligence:import-local-falcon -- <competitor-report.json>");
}

const payload = JSON.parse(await readFile(resolve(inputPath), "utf8")) as unknown;
const result = await importLocalFalconCompetitorReport(payload);
console.log(`Imported ${result.imported} Local Falcon snapshot rows; skipped ${result.skipped}.`);
