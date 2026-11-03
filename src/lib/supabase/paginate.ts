// Supabase returns at most 1,000 rows per request (max_rows in
// supabase/config.toml, and the hosted default). Without paging, a list past
// that point is silently cut short.
//
// PAGE_SIZE must not be larger than max_rows: a page that comes back short
// is taken to be the last one.
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

// Fetches every row by asking for one page at a time. `page` builds a fresh
// query for the given inclusive range; give it a stable order (ending in a
// unique column such as id) so rows don't shift between pages.
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
