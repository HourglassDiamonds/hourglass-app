import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { OpenAiSolBrain } from "@/lib/continuum/concierge-sol/openai";
import { createTravisSolWorld } from "@/lib/continuum/concierge-sol/travis-world";
import { CONTINUUM_MODEL_EVAL_FIXTURES, validateEvalFixtures } from "@/lib/continuum/model-eval/fixtures";
import { formatTerminalReport } from "@/lib/continuum/model-eval/report";
import { runContinuumModelEval } from "@/lib/continuum/model-eval/runner";
import { CONTINUUM_EVAL_MODELS, type ContinuumEvalModel } from "@/lib/continuum/model-eval/types";

function option(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  loadEnvConfig(process.cwd());
  const fixtureErrors = validateEvalFixtures(CONTINUUM_MODEL_EVAL_FIXTURES);
  if (fixtureErrors.length) throw new Error(`Invalid fixtures:\n${fixtureErrors.join("\n")}`);
  if (process.argv.includes("--validate")) {
    console.log(`Validated ${CONTINUUM_MODEL_EVAL_FIXTURES.length} Continuum model-eval fixtures.`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required. Use --validate to validate fixtures without API calls.");
  const models = option("models")?.split(",").map((row) => row.trim()).filter(Boolean) ?? [...CONTINUUM_EVAL_MODELS];
  const unsupportedModels = models.filter((model) => !CONTINUUM_EVAL_MODELS.some((allowed) => allowed === model));
  if (unsupportedModels.length) throw new Error(`Unsupported eval model(s): ${unsupportedModels.join(", ")}`);
  const validatedModels = models as ContinuumEvalModel[];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = resolve(option("out") ?? `artifacts/continuum-model-eval/${stamp}.json`);
  const report = await runContinuumModelEval({ fixtures: CONTINUUM_MODEL_EVAL_FIXTURES, models: validatedModels, dependencies: { worldFactory: createTravisSolWorld, brainFactory: (model) => new OpenAiSolBrain(apiKey, model as ContinuumEvalModel), now: new Date("2026-09-28T13:00:00-04:00") } });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(formatTerminalReport(report));
  console.log(`\nJSON: ${outputPath}`);
  if (report.results.some((row) => row.error)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[continuum:model-eval] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
