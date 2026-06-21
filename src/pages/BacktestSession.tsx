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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/backtesting">
            <Button size="icon" variant="ghost"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{session.name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {session.pair ?? "—"} · {session.strategy ?? "No strategy"} · {trades.length} trades
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!!exporting || trades.length === 0}>
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
            className="gap-2"
          >
            <Plus className="w-4 h-4" /> Add trade
          </Button>
        </div>
      </div>

      <Tabs defaultValue="trades">
        <TabsList>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ai">AI Report</TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trades…"
                className="pl-9"
              />
            </div>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="win">Wins</SelectItem>
                <SelectItem value="loss">Losses</SelectItem>
                <SelectItem value="breakeven">Break-even</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {uniqueSessions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2.5">#</th>
                    <th className="text-left px-3 py-2.5">Pair</th>
                    <th className="text-left px-3 py-2.5">Dir</th>
                    <th className="text-right px-3 py-2.5">Entry</th>
                    <th className="text-right px-3 py-2.5">Exit</th>
                    <th className="text-right px-3 py-2.5">RR</th>
                    <th className="text-left px-3 py-2.5">Result</th>
                    <th className="text-right px-3 py-2.5">R gained</th>
                    <th className="text-left px-3 py-2.5">Setup</th>
                    <th className="text-left px-3 py-2.5">Session</th>
                    <th className="text-right px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lt ? (
                    <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        {trades.length === 0 ? "No trades yet. Add your first manual trade." : "No trades match filters."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((t, i) => (
                      <tr key={t.id} className="border-t border-border/40 hover:bg-background/30">
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{t.pair}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`badge-pill ${
                              t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                            }`}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{t.entry_price ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{t.exit_price ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{t.rr?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`badge-pill ${
                              t.outcome === "win"
                                ? "bg-profit/15 text-profit"
                                : t.outcome === "loss"
                                  ? "bg-loss/15 text-loss"
                                  : "bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {t.outcome}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-semibold ${
                            (t.r_gained ?? 0) >= 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {(t.r_gained ?? 0) >= 0 ? "+" : ""}{(t.r_gained ?? 0).toFixed(2)}R
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{t.setup ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{t.session ?? "—"}</td>
                        <td className="px-3 py-2">
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
