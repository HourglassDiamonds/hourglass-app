import { buildGlobalSiteJsonLd } from "@/lib/seo/schema/entities";
import JsonLd from "./JsonLd";

export default function GlobalJsonLd() {
  return <JsonLd data={buildGlobalSiteJsonLd()} />;
}
