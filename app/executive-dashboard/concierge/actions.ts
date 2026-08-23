"use server";

import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import type { ClientSearchResult } from "@/lib/continuum/client-memory/read/types";

export type ConciergeSearchState =
  | { ok: true; results: ClientSearchResult[] }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function searchConciergeClients(
  query: string,
): Promise<ConciergeSearchState> {
  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  try {
    const results = await auth.reader.searchPeople(query);
    return { ok: true, results };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
