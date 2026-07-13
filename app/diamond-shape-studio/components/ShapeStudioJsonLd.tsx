import JsonLd from "@/app/shared-components/JsonLd";
import { diamondShapeStudioApplicationNode } from "@/lib/seo/schema/entities";
import { diamondShapeStudioBreadcrumb } from "@/lib/seo/schema/breadcrumbs";
import { jsonLdGraph } from "@/lib/seo/schema/json-ld";

export default function ShapeStudioJsonLd() {
  return (
    <JsonLd
      data={jsonLdGraph([
        diamondShapeStudioApplicationNode(),
        diamondShapeStudioBreadcrumb(),
      ])}
    />
  );
}
