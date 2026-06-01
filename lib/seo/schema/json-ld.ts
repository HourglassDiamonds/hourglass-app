import { SCHEMA_CONTEXT } from "./constants";

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };

export type JsonLdGraph = {
  "@context": typeof SCHEMA_CONTEXT;
  "@graph": JsonLdValue[];
};

export function jsonLdGraph(nodes: JsonLdValue[]): JsonLdGraph {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": nodes,
  };
}

export function serializeJsonLd(data: JsonLdValue | JsonLdGraph): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
