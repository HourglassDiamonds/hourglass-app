import type { LedgerIndexId } from "../ledger-data";
import "../ledger-index-system.css";
import LedgerSubnav from "./ledger-subnav";

type LedgerShellProps = {
  children: React.ReactNode;
  /** Highlights active index in subnav; omit on hub-only views if needed */
  activeIndexId?: LedgerIndexId;
  showSubnav?: boolean;
};

export default function LedgerShell({
  children,
  activeIndexId,
  showSubnav = true,
}: LedgerShellProps) {
  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-5 min-[390px]:px-6 md:px-10">
        {showSubnav ? (
          <LedgerSubnav
            activeId={activeIndexId}
            className="mt-3 md:mt-6"
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}
