import JsonLd from "@/app/shared-components/JsonLd";
import { diamondStudioApplicationNode } from "@/lib/seo/schema/entities";
import { diamondStudioBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

export default function DiamondStudioJsonLd() {
  return (
    <JsonLd
      data={jsonLdGraph([
        diamondStudioApplicationNode(),
        diamondStudioBreadcrumb(),
      ])}
    />
  );
}
