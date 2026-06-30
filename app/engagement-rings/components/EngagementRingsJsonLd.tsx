import JsonLd from "@/app/shared-components/JsonLd";
import { marketingPageBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import { engagementRingsFaqNode } from "@/lib/seo/schema/entities";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

export default function EngagementRingsJsonLd() {
  return (
    <JsonLd
      data={jsonLdGraph([
        marketingPageBreadcrumb("Engagement Rings", "/engagement-rings"),
        engagementRingsFaqNode(),
      ])}
    />
  );
}
