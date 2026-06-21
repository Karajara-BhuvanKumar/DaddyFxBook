import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, ExternalLink, FlaskConical,
  Download, FileSpreadsheet, FileText, FileType, BarChart3, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useBacktestSession,
  useBacktestTrades,
  useCreateTrade,
  useDeleteTrade,
  useUpdateTrade,
} from "@/hooks/useBacktest";
import { computeAnalytics, type BacktestTrade } from "@/lib/backtest";
import TradeFormDialog from "@/components/backtest/TradeFormDialog";
import AnalyticsPanel from "@/components/backtest/AnalyticsPanel";
import AIReportPanel from "@/components/backtest/AIReportPanel";
import { exportTradesCSV, exportTradesXLSX, exportAnalyticsDOCX, exportAnalyticsPDF } from "@/lib/exports";

export default function BacktestSession() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading: ls } = useBacktestSession(id);
  const { data: trades = [], isLoading: lt } = useBacktestTrades(id);
  const create = useCreateTrade(id ?? "");
  const update = useUpdateTrade(id ?? "");
  const del = useDeleteTrade(id ?? "");
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BacktestTrade | null>(null);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [exporting, setExporting] = useState<string | null>(null);

  const runExport = async (kind: string, fn: () => void | Promise<void>) => {
    try {
      setExporting(kind);
      await fn();
      toast({ title: "Export ready", description: `${kind} file downloaded` });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (outcomeFilter !== "all" && t.outcome !== outcomeFilter) return false;
      if (sessionFilter !== "all" && (t.session ?? "") !== sessionFilter) return false;
      if (q) {
        const hay = [t.pair, t.setup, t.session, t.notes, t.market_condition]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trades, search, outcomeFilter, sessionFilter]);

  const analytics = useMemo(() => computeAnalytics(trades), [trades]);
  const uniqueSessions = useMemo(
    () => Array.from(new Set(trades.map((t) => t.session).filter(Boolean) as string[])),
    [trades],
  );

  if (ls) {
    return <div className="p-6"><Skeleton className="h-12 w-64 mb-4" /><Skeleton className="h-96 w-full" /></div>;
  }
  if (!session) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Session not found.</p>
        <Link to="/backtesting" className="text-primary text-sm underline">Back to Strategy Lab</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 overflow-guard">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to="/backtesting">
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-zinc-400 hover:text-white bg-[#0B0B0B] border border-white/[0.06] rounded-[20px]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">{session.name}</h1>
            <p className="text-xs sm:text-[13px] text-zinc-500 font-semibold truncate mt-0.5">
              {session.pair ?? "—"} <span className="mx-1.5 opacity-50">•</span> {session.strategy ?? "No strategy"} <span className="mx-1.5 opacity-50">•</span> {trades.length} trades
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 w-full sm:w-auto bg-[#0B0B0B] border-white/[0.06] text-zinc-300 hover:text-white rounded-[20px] h-11 min-h-[44px]" disabled={!!exporting || trades.length === 0}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Generating…" : "Download"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Export session data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Trades
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => runExport("CSV", () => exportTradesCSV(session, trades))}>
                    <FileText className="w-4 h-4 mr-2" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport("Excel", () => exportTradesXLSX(session, trades))}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <FileType className="w-4 h-4 text-primary" /> Analytics
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => runExport("Word", () => exportAnalyticsDOCX(session, trades, analytics))}>
                    <FileText className="w-4 h-4 mr-2" /> Export Word (.docx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport("PDF", () => exportAnalyticsPDF(session, trades, analytics))}>
                    <FileType className="w-4 h-4 mr-2" /> Export PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[20px] h-11 min-h-[44px] px-4"
          >
            <Plus className="w-4 h-4" /> Add trade
          </Button>
        </div>
      </div>

      <Tabs defaultValue="trades">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start scrollbar-none">
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ai">AI Report</TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trades…"
                className="pl-11 bg-[#0B0B0B] border-white/[0.06] text-white placeholder:text-zinc-600 rounded-[20px] h-10"
              />
            </div>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-full sm:w-[140px] bg-[#0B0B0B] border-white/[0.06] text-zinc-300 rounded-[20px] h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="win">Wins</SelectItem>
                <SelectItem value="loss">Losses</SelectItem>
                <SelectItem value="breakeven">Break-even</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-full sm:w-[140px] bg-[#0B0B0B] border-white/[0.06] text-zinc-300 rounded-[20px] h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {uniqueSessions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-[24px] border border-white/[0.06] bg-[#0B0B0B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0B0B0B] border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Pair</th>
                    <th className="text-left px-4 py-3">Dir</th>
                    <th className="text-right px-4 py-3">Entry</th>
                    <th className="text-right px-4 py-3">Exit</th>
                    <th className="text-right px-4 py-3">RR</th>
                    <th className="text-left px-4 py-3">Result</th>
                    <th className="text-right px-4 py-3">R gained</th>
                    <th className="text-left px-4 py-3">Setup</th>
                    <th className="text-left px-4 py-3">Session</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {lt ? (
                    <tr><td colSpan={11} className="p-6 text-center text-zinc-500 font-medium">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        {trades.length === 0 ? "No trades yet. Add your first manual trade." : "No trades match filters."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t, i) => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-zinc-500 font-medium tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-bold text-white">{t.pair}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              t.direction === "long" ? "bg-blue-500/10 text-blue-500 border border-blue-500/10" : "bg-red-500/10 text-red-500 border border-red-500/10"
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-zinc-300">{t.entry_price ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-zinc-300">{t.exit_price ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-zinc-400">{t.rr?.toFixed(2) ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              t.outcome === "win"
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/10"
                                : t.outcome === "loss"
                                  ? "bg-red-500/10 text-red-500 border border-red-500/10"
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}
                          >
                            {t.outcome}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono font-bold ${
                            (t.r_gained ?? 0) >= 0 ? "text-blue-500" : "text-red-500"
                          }`}
                        >
                          {(t.r_gained ?? 0) >= 0 ? "+" : ""}{(t.r_gained ?? 0).toFixed(2)}R
                        </td>
                        <td className="px-4 py-3 text-zinc-400 font-medium">{t.setup ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-400 font-medium">{t.session ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {t.screenshot_url && (
                              <a href={t.screenshot_url} target="_blank" rel="noreferrer">
                                <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                              </a>
                            )}
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => { setEditing(t); setFormOpen(true); }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => {
                                if (confirm("Delete this trade?")) {
                                  del.mutate(t.id, { onSuccess: () => toast({ title: "Trade deleted" }) });
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel a={analytics} />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIReportPanel sessionId={id!} hasTrades={trades.length > 0} />
        </TabsContent>
      </Tabs>

      <TradeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        sessionId={id!}
        defaultPair={session.pair ?? "XAUUSD"}
        initial={editing}
        onSave={async (patch) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...patch });
            toast({ title: "Trade updated" });
          } else {
            await create.mutateAsync(patch);
            toast({ title: "Trade added" });
          }
        }}
      />
    </div>
  );
}
