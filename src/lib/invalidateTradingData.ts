import type { QueryClient } from '@tanstack/react-query';

/** Keep every view of an account in sync after a saved change, including inactive pages. */
export function invalidateTradingData(client: QueryClient) {
  return Promise.all(['trades', 'journal', 'journals-all', 'checklist', 'screenshots', 'performance-coach-data'].map(key =>
    client.invalidateQueries({ queryKey: [key] }),
  ));
}
