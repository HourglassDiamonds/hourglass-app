/**
 * Next.js instrumentation — server startup hooks only.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateIntelligenceEnvOnStartup } = await import(
      "./lib/intelligence/validate-env"
    );
    validateIntelligenceEnvOnStartup();
  }
}
