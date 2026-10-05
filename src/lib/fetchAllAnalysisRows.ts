// Keyset pagination also works when the server caps pages below the requested size.
// A failed page rejects the whole result; partial totals must never appear complete.
export async function fetchAllAnalysisRows<T extends { id: string }>(page: (after?: string) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    const { data, error } = await page(after);
    if (error) throw error;
    if (!data?.length) return rows;
    if (data.some((row, index) => !row.id || (index ? row.id <= data[index - 1].id : after !== undefined && row.id <= after))) throw new Error('Analysis pagination did not advance.');
    rows.push(...data);
    after = data[data.length - 1].id;
  }
}
