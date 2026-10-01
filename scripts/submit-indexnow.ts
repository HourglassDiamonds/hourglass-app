import { loadEnvConfig } from "@next/env";
import sitemap from "../app/sitemap";
import { normalizeIndexNowUrls } from "../lib/seo/indexnow-core";
import { submitIndexNowUrls } from "../lib/seo/indexnow";

async function main() {
  loadEnvConfig(process.cwd());
  const requested = process.argv.slice(2);
  if (requested.length === 0) {
    throw new Error(
      "Pass one or more materially changed canonical paths, for example: npm run indexnow:submit -- /diamond-studio",
    );
  }

  const urls = normalizeIndexNowUrls(requested);
  const publicUrls = new Set(sitemap().map((entry) => entry.url));
  const nonPublic = urls.filter((url) => !publicUrls.has(url));
  if (nonPublic.length > 0) {
    throw new Error(
      `Refusing to submit URLs that are not in the public sitemap: ${nonPublic.join(", ")}`,
    );
  }

  const result = await submitIndexNowUrls(urls);
  if (result.status !== "accepted") {
    throw new Error(`IndexNow submission did not complete: ${JSON.stringify(result)}`);
  }

  console.log(
    `IndexNow accepted ${result.submitted} URL(s) with HTTP ${result.httpStatus}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "IndexNow submission failed.");
  process.exitCode = 1;
});
