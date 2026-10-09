import type { StrategySetup } from '@/lib/strategySetup';

export type CustomCheck = { id: string; label: string; checked: boolean };
export function readCustomChecklist(raw: string | null | undefined): CustomCheck[] {
  try {
    const list = JSON.parse(raw || '{}').custom_checklist;
    return Array.isArray(list) ? list.filter((item): item is CustomCheck => !!item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.checked === 'boolean') : [];
  } catch { return []; }
}
export function serializeJournalSetup(setup: StrategySetup, custom: CustomCheck[]) {
  return JSON.stringify({ ...setup, custom_checklist: custom });
}

// Unsaved work survives navigation within this tab, without persisting private notes to disk.
export const journalDrafts = new Map<string, { snapshot: string; baseline: string }>();
