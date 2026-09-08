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
  const limit = Number.isInteger(cap) && cap > 0 ? cap : CANDIDATE_LIST_MAX_ROWS;
  const rows: T[] = [];
  for (let offset = 0; offset < limit; offset += size) {
    const to = Math.min(offset + size - 1, limit - 1);
    const requested = to - offset + 1;
    const chunk = await fetchPage(offset, to);
    rows.push(...chunk);
    if (chunk.length < requested) break;
    if (rows.length >= limit) break;
  }
  return rows.slice(0, limit);
}
