import JsonLd from "@/app/shared-components/JsonLd";
import { buildLedgerMonitorJsonLd } from "../ledger-seo";

export default function LedgerPageJsonLd({
  name,
  path,
  description,
}: {
  name: string;
  path: string;
  description: string;
}) {
  return (
    <JsonLd data={buildLedgerMonitorJsonLd({ name, path, description })} />
  );
}

