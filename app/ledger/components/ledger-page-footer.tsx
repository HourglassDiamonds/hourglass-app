import Link from "next/link";

export default function LedgerPageFooter() {
  return (
    <section className="ledger-page-footer border-t border-[#e4dbcf] pb-16 md:pb-20">
      <p className="text-center text-[0.88rem] leading-[1.8] text-[#6d655e]">
        <Link href="/ledger" className="hover:text-[#1f1d1a]">
          Back to The Ledger
        </Link>
      </p>
    </section>
  );
}
