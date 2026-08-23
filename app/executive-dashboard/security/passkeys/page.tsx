import Link from "next/link";
import { EXECUTIVE_DASHBOARD_CONCIERGE_PATH } from "@/lib/executive-dashboard/access";
import { listActiveFounderPasskeys } from "@/lib/executive-dashboard/passkeys/load";
import { PasskeysManager } from "./passkeys-manager";

export default async function FounderPasskeysPage() {
  const listed = await listActiveFounderPasskeys();
  const unavailable = !listed.ok;
  const passkeys = listed.ok
    ? listed.passkeys.map((row) => ({
        id: row.id,
        label: row.label,
        createdAt: row.createdAt,
      }))
    : [];

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(173,145,100,0.08),_transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          <Link
            href={EXECUTIVE_DASHBOARD_CONCIERGE_PATH}
            className="inline-flex min-h-11 items-center outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Continuum
          </Link>
        </p>
        <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Passkeys
        </h1>
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Founder devices only. Password sign-in remains.
        </p>
        <PasskeysManager passkeys={passkeys} unavailable={unavailable} />
      </div>
    </main>
  );
}
