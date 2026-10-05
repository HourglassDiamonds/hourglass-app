import Link from "next/link";
import { LEDGER_INDEXES, type LedgerIndexId } from "../ledger-data";

type LedgerSubnavProps = {
  activeId?: LedgerIndexId;
  className?: string;
};

export default function LedgerSubnav({
  activeId,
  className = "",
}: LedgerSubnavProps) {
  return (
    <nav
      aria-label="Ledger indexes"
      className={`-mx-5 overflow-x-auto border-b border-[#e4dbcf]/80 px-5 pb-1 [scrollbar-width:none] min-[390px]:-mx-6 min-[390px]:px-6 md:mx-0 md:overflow-visible md:px-0 md:pb-2 [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <ul className="flex w-max flex-nowrap items-center gap-x-1 whitespace-nowrap font-sans text-[9px] uppercase tracking-[0.12em] text-[#6d655e] md:w-auto md:flex-wrap md:gap-x-2 md:text-[10px] md:tracking-[0.16em]">
        {LEDGER_INDEXES.map((index, i) => (
          <li key={index.id} className="flex items-center">
            {i > 0 ? (
              <span className="mx-1 text-[#d4cdc4] md:mx-1.5" aria-hidden>
                ·
              </span>
            ) : null}
            <Link
              href={`/ledger/${index.slug}`}
              className={`inline-flex min-h-11 items-center px-1 ${
                activeId === index.id
                  ? "text-[#4a4540]"
                  : "hover:text-[#1f1d1a]"
              }`}
              aria-current={activeId === index.id ? "page" : undefined}
            >
              {index.subnavLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
