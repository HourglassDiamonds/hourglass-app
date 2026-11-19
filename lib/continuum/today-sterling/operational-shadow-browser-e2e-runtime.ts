/** Local production-build browser fixture. This must remain impossible on Vercel. */
export function isOperationalShadowBrowserE2eRuntime(): boolean {
  return process.env.CONTINUUM_OPERATIONAL_SHADOW_BROWSER_E2E === "1" &&
    process.env.NODE_ENV === "production" && process.env.VERCEL !== "1";
}
