import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_CONCIERGE_PATH,
  EXECUTIVE_DASHBOARD_ROOT_PATH,
} from "@/lib/executive-dashboard/access";
import { isExecutiveDashboardPublicProduction } from "@/lib/executive-dashboard/env";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { founderPasskeysAreEnrolled } from "@/lib/executive-dashboard/passkeys/load";
import { ExecutiveDashboardLoginForm } from "../login-form";
import { PasskeyLoginButton } from "../passkey-login-button";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ExecutiveDashboardLoginPage() {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );

  if (session.ok) {
    redirect(
      isExecutiveDashboardPublicProduction()
        ? EXECUTIVE_DASHBOARD_CONCIERGE_PATH
        : EXECUTIVE_DASHBOARD_ROOT_PATH,
    );
  }

  const passkeysAvailable = await founderPasskeysAreEnrolled();

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(173,145,100,0.08),_transparent_58%)]"
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Continuum
        </p>
        <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Concierge
        </h1>
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Sign in with founder credentials. This surface is private and is not
          indexed.
        </p>
        <div className="mt-10 space-y-8">
          {passkeysAvailable ? (
            <>
              <PasskeyLoginButton />
              <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.28em] text-[#8d8073]">
                <span className="h-px flex-1 bg-white/[0.08]" />
                or
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
            </>
          ) : null}
          <ExecutiveDashboardLoginForm />
        </div>
      </div>
    </main>
  );
}
