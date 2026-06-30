import JsonLd from "@/app/shared-components/JsonLd";
import { diamondIntelligenceBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import {
  diamondIntelligenceApplicationNode,
  diamondIntelligenceFaqNode,
} from "@/lib/seo/schema/entities";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

export default function DiamondIntelligenceJsonLd() {
  return (
    <JsonLd
      data={jsonLdGraph([
        diamondIntelligenceApplicationNode(),
        diamondIntelligenceFaqNode(),
        diamondIntelligenceBreadcrumb(),
      ])}
    />
  );
}
