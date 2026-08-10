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
      className={`border-b border-[#e4dbcf]/80 pb-2 ${className}`}
    >
      <ul className="flex flex-wrap items-center gap-x-1 font-sans text-[10px] uppercase tracking-[0.14em] text-[#6d655e] md:gap-x-2 md:tracking-[0.16em]">
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
