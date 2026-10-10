import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BreakdownRow } from "@/lib/backtest";

export const formatR = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
export const resultClass = (n: number) => n > 0 ? "bt-profit" : n < 0 ? "bt-loss" : "bt-neutral";

export function BreakdownTable({ rows, setup = false }: { rows: BreakdownRow[]; setup?: boolean }) {
  return <table className={`bt-breakdown-table ${setup ? "bt-setup-table" : ""}`}>
    <thead><tr><th scope="col">{setup ? "Setup name" : "Name"}</th><th scope="col">Trades</th><th scope="col">Win rate</th><th scope="col">Net R</th></tr></thead>
    <tbody>{rows.map(r => <tr key={r.key}>
      <th scope="row"><span>{r.key}</span>{setup && r.trades <= 2 && <small>Small sample · {r.trades} {r.trades === 1 ? "trade" : "trades"}</small>}</th>
      <td data-label="Trades">{r.trades}</td>
      <td data-label="Win rate"><span>{(r.winRate * 100).toFixed(0)}%</span>{setup && <div className="bt-win-track" aria-hidden="true"><i style={{ width: `${r.winRate * 100}%` }} /></div>}</td>
      <td data-label="Net R" className={resultClass(r.netR)}>{formatR(r.netR)}</td>
    </tr>)}</tbody>
  </table>;
}

const PAGE_SIZE = 10;
export default function SetupAnalysis({ rows }: { rows: BreakdownRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("net-desc");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const matches = rows.filter(r => r.key.toLowerCase().includes(search.trim().toLowerCase()));
    return matches.sort((a, b) => {
      if (sort === "net-asc") return a.netR - b.netR || a.key.localeCompare(b.key);
      if (sort === "trades") return b.trades - a.trades || b.netR - a.netR;
      if (sort === "win-rate") return b.winRate - a.winRate || b.trades - a.trades;
      if (sort === "name") return a.key.localeCompare(b.key);
      return b.netR - a.netR || a.key.localeCompare(b.key);
    });
  }, [rows, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  return <section className="bt-panel bt-setups" aria-label="By setup">
    <div className="bt-setup-heading"><div><div className="bt-title-row"><h2>By setup</h2><span className="bt-count">{rows.length} setups</span></div><p>Compare complete setups by return, win rate, and sample size.</p></div><span className="bt-setup-note">{sort === "net-desc" ? "Highest net R first" : sort === "net-asc" ? "Lowest net R first" : sort === "trades" ? "Most trades first" : sort === "win-rate" ? "Highest win rate first" : "Alphabetical order"}</span></div>
    <div className="bt-setup-tools">
      <div className="relative min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 h-11 rounded-xl" aria-label="Search setups" placeholder="Search complete setup names…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
      <label className="bt-sort"><span>Sort by</span><select aria-label="Sort setups" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="net-desc">Net R: high to low</option><option value="net-asc">Net R: low to high</option><option value="trades">Most trades</option><option value="win-rate">Highest win rate</option><option value="name">Setup name: A–Z</option></select></label>
    </div>
    {filtered.length ? <BreakdownTable rows={filtered.slice(start, start + PAGE_SIZE)} setup /> : <div className="bt-empty"><p>{rows.length ? "No setups match your search." : "No setup data yet."}</p>{search && <Button variant="ghost" onClick={() => { setSearch(""); setPage(0); }}>Clear search</Button>}</div>}
    <div className="bt-setup-footer"><span aria-live="polite">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} setups` : "0 setups"}</span><div><Button variant="outline" size="icon" aria-label="Previous setup page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button><span>Page {currentPage + 1} of {pages}</span><Button variant="outline" size="icon" aria-label="Next setup page" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button></div></div>
  </section>;
}
