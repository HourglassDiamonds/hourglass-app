import Link from "next/link";

type LedgerIndexBreadcrumbProps = {
  current: string;
};

export default function LedgerIndexBreadcrumb({
  current,
}: LedgerIndexBreadcrumbProps) {
  return (
    <nav className="ledger-index-breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <span className="ledger-index-breadcrumb-sep">/</span>
      <Link href="/ledger">Ledger</Link>
      <span className="ledger-index-breadcrumb-sep">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
