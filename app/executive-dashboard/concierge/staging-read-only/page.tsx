import { notFound } from "next/navigation";
import { CommandCenterHome } from "../components/command-center-home";
import { ContinuumMark } from "../components/continuum-mark";
import { loadContinuumHomeModel } from "@/lib/continuum/dashboard/server";
import {
  PRODUCTION_STAGING_AUTH_ROUTE,
} from "@/lib/continuum/production-staging-access";
import { loadProductionStagingToday } from "@/lib/continuum/production-staging-today";
import { isVerifiedContinuumProductionStagingRuntime } from "@/lib/continuum/runtime-env";

export const fetchCache = "force-no-store";

export const metadata = {
  title: "Continuum · Read-only staging",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

const STATUS_COPY = {
  ready: "Persisted Today is current with canonical records.",
  stale: "Persisted Today is stale. This read-only deployment will not rebuild it.",
  absent: "No compatible persisted Today snapshot is available.",
  unavailable: "Snapshot freshness could not be verified. No rebuild was attempted.",
} as const;

export default async function ProductionStagingContinuumPage() {
  if (!isVerifiedContinuumProductionStagingRuntime()) notFound();
  const [model, today] = await Promise.all([
    Promise.resolve(loadContinuumHomeModel()),
    loadProductionStagingToday(),
  ]);

  return (
    <main
      data-production-staging-continuum="read-only"
      className="relative min-h-[100dvh] bg-[#14110f] text-[#efe8de]"
    >
      <header className="border-b border-white/[0.08] px-5 py-4 md:px-8">
        <div className="mx-auto flex w-full max-w-[75rem] items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <ContinuumMark size={30} decorative />
            <div>
              <p className="font-serif text-[1.05rem] tracking-[0.08em]">Continuum</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#8d8073]">Read-only staging</p>
            </div>
          </div>
          <form action={PRODUCTION_STAGING_AUTH_ROUTE} method="post">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit" className="min-h-11 text-[10px] uppercase tracking-[0.2em] text-[#8d8073]">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[75rem] px-5 pb-16 pt-7 md:px-8">
        <div
          data-staging-today-status={today.status}
          className="mb-7 border-l border-[#ad9164]/50 pl-4 text-[13px] leading-relaxed text-[#b8ada2]"
          role="status"
        >
          {STATUS_COPY[today.status]}
          {today.snapshot?.composedAt ? (
            <span className="block text-[11px] text-[#756c64]">
              Snapshot composed {today.snapshot.composedAt}
            </span>
          ) : null}
        </div>
        {today.snapshot ? (
          <CommandCenterHome
            model={model}
            docket={today.snapshot.payload.docket}
            readOnly
          />
        ) : (
          <section className="max-w-xl" data-staging-today-empty="">
            <h1 className="font-serif text-[2rem] tracking-[-0.04em]">Today is unavailable.</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#9a8e82]">
              This staging view never creates or replaces Today display state. Use the separately authorized Production workflow to recompute it.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
