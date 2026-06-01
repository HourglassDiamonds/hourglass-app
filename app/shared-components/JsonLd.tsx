import { SCHEMA_CONTEXT } from "@/lib/seo/schema/constants";
import { serializeJsonLd, type JsonLdValue } from "@/lib/seo/schema/json-ld";

type JsonLdProps = {
  data: JsonLdValue;
};

function isJsonLdObject(
  data: JsonLdValue,
): data is { [key: string]: JsonLdValue } {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

function withSchemaContext(data: JsonLdValue): JsonLdValue {
  if (isJsonLdObject(data) && "@context" in data) {
    return data;
  }

  if (isJsonLdObject(data)) {
    return {
      "@context": SCHEMA_CONTEXT,
      ...data,
    };
  }

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": Array.isArray(data) ? data : [data],
  };
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(withSchemaContext(data)) }}
    />
  );
}
