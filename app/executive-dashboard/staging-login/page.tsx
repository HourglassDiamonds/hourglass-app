import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContinuumMark } from "../concierge/components/continuum-mark";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import {
  PRODUCTION_STAGING_AUTH_ROUTE,
  PRODUCTION_STAGING_CONTINUUM_PATH,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
} from "@/lib/continuum/production-staging-access";
import {
  isVerifiedContinuumProductionShadowRuntime,
  isVerifiedContinuumProductionStagingRuntime,
} from "@/lib/continuum/runtime-env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";

export const metadata = {
  title: "Founder staging sign in",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ProductionStagingFounderLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const productionShadow = isVerifiedContinuumProductionShadowRuntime();
  if (!productionShadow && !isVerifiedContinuumProductionStagingRuntime()) redirect("/");
  const destination = productionShadow
    ? PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH
    : PRODUCTION_STAGING_CONTINUUM_PATH;

  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (session.ok) redirect(destination);
  const { error } = await searchParams;

  return (
    <main className="relative min-h-[100dvh] bg-[#14110f] text-[#efe8de]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 py-12">
        <ContinuumMark size={56} />
        <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Protected staging
        </p>
        <h1 className="mt-3 font-serif text-[2.15rem]">Founder sign in</h1>
        <p className="mt-4 text-[14px] leading-relaxed text-[#c4b7aa]">
          {productionShadow
            ? "This staged Production-target deployment permits one fixed-scope native Gmail shadow review. Business writes, Today publication, OAuth reconnect, and outbound activity remain blocked."
            : "This deployment permits durable founder authentication only. Server Actions, Gmail, Today recomputation, Concierge writes, and outbound activity are blocked."}
        </p>
        <form
          action={PRODUCTION_STAGING_AUTH_ROUTE}
          method="post"
          className="mt-10 space-y-5"
        >
          <input type="hidden" name="intent" value="login" />
          <input type="hidden" name="next" value={destination} />
          <input type="hidden" name="viewport" value="desktop" />
          <label className="block text-[10px] uppercase tracking-[0.24em] text-[#8d8073]">
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              className="mt-2 min-h-12 w-full rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[16px] text-[#efe8de]"
            />
          </label>
          <label className="block text-[10px] uppercase tracking-[0.24em] text-[#8d8073]">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 min-h-12 w-full rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[16px] text-[#efe8de]"
            />
          </label>
          {error ? (
            <p role="alert" className="text-[13px] text-[#d2b8a8]">
              Sign-in failed. Check the credentials and try again.
            </p>
          ) : null}
          <button
            type="submit"
            className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em]"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
