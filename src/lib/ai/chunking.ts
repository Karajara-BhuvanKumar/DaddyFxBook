// ============================================================
// Chunking Engine
// Splits large trade/journal datasets into manageable chunks
// to prevent context window overflow.
// ============================================================

import type { Trade, Journal, Checklist } from "@/hooks/useTrades";
import { CHUNK_SIZE_TRADES, MAX_TRADES_PER_PROMPT } from "./constants";
import { estimateJsonTokens } from "./tokenEstimator";

export interface DataChunk {
  chunkIndex: number;
  totalChunks: number;
  trades: Trade[];
  journals: Journal[];
  checklists: Checklist[];
  screenshots: any[];
}

export interface ChunkingResult {
  chunks: DataChunk[];
  totalTrades: number;
  wasCapped: boolean;
  cappedTo: number;
}

/**
 * Splits trade data into token-safe chunks.
 * Prioritises the most recent trades (trades are assumed ordered by
 * close_time DESC from the database).
 */
export function chunkTradeData(
  trades: Trade[],
  journals: Journal[],
  checklists: Checklist[],
  screenshots: any[],
  overrideChunkSize?: number,
): ChunkingResult {
  const chunkSize = overrideChunkSize ?? CHUNK_SIZE_TRADES;

  // Cap total trades
  const cappedTrades = trades.slice(0, MAX_TRADES_PER_PROMPT);
  const wasCapped = trades.length > MAX_TRADES_PER_PROMPT;

  // Build lookup maps once
  const journalMap = new Map(journals.map((j) => [j.trade_id, j]));
  const checklistMap = new Map(checklists.map((c) => [c.trade_id, c]));
  const screenshotMap = new Map<string, any[]>();
  screenshots.forEach((s) => {
    const arr = screenshotMap.get(s.trade_id) ?? [];
    arr.push(s);
    screenshotMap.set(s.trade_id, arr);
  });

  // Split trades into fixed-size chunks
  const tradeChunks: Trade[][] = [];
  for (let i = 0; i < cappedTrades.length; i += chunkSize) {
    tradeChunks.push(cappedTrades.slice(i, i + chunkSize));
  }

  const chunks: DataChunk[] = tradeChunks.map((chunkTrades, idx) => {
    const chunkJournals = chunkTrades
      .map((t) => journalMap.get(t.id))
      .filter((j): j is Journal => j !== undefined);
    const chunkChecklists = chunkTrades
      .map((t) => checklistMap.get(t.id))
      .filter((c): c is Checklist => c !== undefined);
    const chunkScreenshots = chunkTrades.flatMap((t) => screenshotMap.get(t.id) ?? []);

    return {
      chunkIndex: idx,
      totalChunks: tradeChunks.length,
      trades: chunkTrades,
      journals: chunkJournals,
      checklists: chunkChecklists,
      screenshots: chunkScreenshots,
    };
  });

  return {
    chunks,
    totalTrades: cappedTrades.length,
    wasCapped,
    cappedTo: MAX_TRADES_PER_PROMPT,
  };
}

/**
 * For a single-pass analysis (the default AI Report flow),
 * returns a single merged chunk using the full capped dataset.
 */
export function buildSingleChunk(
  trades: Trade[],
  journals: Journal[],
  checklists: Checklist[],
  screenshots: any[],
): DataChunk {
  const cappedTrades = trades.slice(0, MAX_TRADES_PER_PROMPT);
  const journalMap = new Map(journals.map((j) => [j.trade_id, j]));
  const checklistMap = new Map(checklists.map((c) => [c.trade_id, c]));
  const screenshotArr = screenshots.filter((s) =>
    cappedTrades.some((t) => t.id === s.trade_id),
  );

  return {
    chunkIndex: 0,
    totalChunks: 1,
    trades: cappedTrades,
    journals: cappedTrades
      .map((t) => journalMap.get(t.id))
      .filter((j): j is Journal => j !== undefined),
    checklists: cappedTrades
      .map((t) => checklistMap.get(t.id))
      .filter((c): c is Checklist => c !== undefined),
    screenshots: screenshotArr,
  };
}
