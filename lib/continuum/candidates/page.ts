/**
 * Page through continuum_candidates. Supabase list() is silently capped at 1,000.
 */

export const CANDIDATE_LIST_PAGE_SIZE = 1000 as const;
export const CANDIDATE_LIST_MAX_ROWS = 20_000 as const;

export async function collectPagedRows<T>(
  fetchPage: (from: number, to: number) => Promise<readonly T[]>,
  pageSize = CANDIDATE_LIST_PAGE_SIZE,
  cap = CANDIDATE_LIST_MAX_ROWS,
): Promise<T[]> {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : CANDIDATE_LIST_PAGE_SIZE;
  const rows: T[] = [];
  for (let offset = 0; offset < cap; offset += size) {
    const chunk = await fetchPage(offset, offset + size - 1);
    rows.push(...chunk);
    if (chunk.length < size) break;
  }
  return rows;
}
