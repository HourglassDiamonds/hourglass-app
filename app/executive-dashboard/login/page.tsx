import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  EXECUTIVE_DASHBOARD_ROOT_PATH,
  getExecutiveDashboardAccessDecision,
} from "@/lib/executive-dashboard/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { ExecutiveDashboardLoginForm } from "../login-form";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ExecutiveDashboardLoginPage() {
  const jar = await cookies();
  const decision = getExecutiveDashboardAccessDecision({
    cookieValue: jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  });

  if (decision.status === "authenticated") {
    redirect(EXECUTIVE_DASHBOARD_ROOT_PATH);
  }

  return (
    <main className="relative min-h-screen bg-[#f7f3ec] text-[#1f1c19]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.72),_transparent_55%),linear-gradient(180deg,#f7f3ec_0%,#efe8dc_100%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
        <p className="font-serif text-[1.65rem] tracking-[-0.02em] text-[#1f1c19]">
          Hourglass Diamonds
        </p>
        <h1 className="mt-3 text-[11px] uppercase tracking-[0.34em] text-[#948a80]">
          Executive access
        </h1>
        <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#5f5851]">
          Sign in with founder credentials. This surface is private and is not
          indexed.
        </p>
        <div className="mt-10">
          <ExecutiveDashboardLoginForm />
        </div>
      </div>
    </main>
  );
}
