import Link from "next/link";

type LedgerIndexBreadcrumbProps = {
  current: string;
};

export default function LedgerIndexBreadcrumb({
  current,
}: LedgerIndexBreadcrumbProps) {
  return (
    <nav className="ledger-index-breadcrumb" aria-label="Breadcrumb">
      <Link href="/ledger">The Ledger</Link>
      <span className="ledger-index-breadcrumb-sep">/</span>
      <span>{current}</span>
    </nav>
  );
}
