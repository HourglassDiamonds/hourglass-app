import Link from "next/link";
import { EXECUTIVE_DASHBOARD_PASSKEYS_PATH } from "@/lib/executive-dashboard/access";
import { ConciergeSearch } from "./components/concierge-search";
import { ConciergeShell } from "./components/concierge-shell";
import { ConciergeSignOut } from "./components/concierge-sign-out";

export default function ConciergeHomePage() {
  return (
    <ConciergeShell
      footer={
        <div className="mt-16 flex items-center justify-between gap-4">
          <Link
            href={EXECUTIVE_DASHBOARD_PASSKEYS_PATH}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Passkeys
          </Link>
          <ConciergeSignOut />
        </div>
      }
    >
      <h1 className="font-serif text-[2.45rem] font-normal leading-[1.05] tracking-[-0.045em] text-[#efe8de] md:text-[2.9rem]">
        Concierge
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
        Your relationship memory.
      </p>
      <div className="mt-10">
        <ConciergeSearch />
      </div>
    </ConciergeShell>
  );
}
