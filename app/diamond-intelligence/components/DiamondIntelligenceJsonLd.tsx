import JsonLd from "@/app/shared-components/JsonLd";
import { diamondIntelligenceBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import {
  diamondIntelligenceApplicationNode,
  diamondIntelligenceFaqNode,
  diamondIntelligenceWebPageNode,
} from "@/lib/seo/schema/entities";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

export default function DiamondIntelligenceJsonLd() {
  return (
    <JsonLd
      data={jsonLdGraph([
        diamondIntelligenceWebPageNode(),
        diamondIntelligenceApplicationNode(),
        diamondIntelligenceFaqNode(),
        diamondIntelligenceBreadcrumb(),
      ])}
    />
  );
}
