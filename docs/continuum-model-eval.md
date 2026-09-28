# Continuum model evaluation

This harness compares `gpt-5.6-sol` and `gpt-6-sol` with the same read-only Continuum fixture world and the production `OpenAiSolBrain` / Responses API / `runConciergeSol` path.

```sh
npm run continuum:model-eval
```

Set `OPENAI_API_KEY` in the process environment or a standard Next.js `.env` file. By default the JSON report is written under `artifacts/continuum-model-eval/`. To choose a path or a subset of models:

```sh
npm run continuum:model-eval -- --out=artifacts/my-run.json
npm run continuum:model-eval -- --models=gpt-6-sol
npm run continuum:model-eval -- --validate
```

The terminal report places both models under each fixture and reports deterministic checks, latency, token counts, and tool use. The JSON retains the prompt, response, requested and API-reported model, tool names, explicit check results, errors, and blank human-review fields for correctness, judgment, usefulness, and trustworthiness.

There is deliberately no aggregate quality score. Review the grounded/correct, expected-tools, unsupported-claim, structured-output, inference-success, and no-canonical-write checks separately, then add human judgments to the generated JSON if needed.

The harness only constructs `createTravisSolWorld`, whose methods are read-only fixture data. It never creates Supabase readers or persistence stores. `runConciergeSol` also returns `writesCanonical: false`; the harness treats any violation as a failed case. A Responses API failure may trigger the production fallback, but the eval records that as `model-inference-fell-back` and fails the inference check instead of crediting fallback behavior to a model.
