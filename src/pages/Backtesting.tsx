import { useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Plus, MoreVertical, Copy, Pencil, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useBacktestSessions,
  useCreateSession,
  useDeleteSession,
  useDuplicateSession,
  useUpdateSession,
} from "@/hooks/useBacktest";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { BacktestSession, BacktestTrade } from "@/lib/backtest";
import { computeAnalytics } from "@/lib/backtest";

function SessionCard({ s }: { s: BacktestSession }) {
  const del = useDeleteSession();
  const dup = useDuplicateSession();
  const upd = useUpdateSession();
  const { toast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(s.name);

  const { data: stats } = useQuery({
    queryKey: ["backtest-session-stats", s.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("backtest_trades")
        .select("*")
        .eq("session_id", s.id);
      const a = computeAnalytics((data ?? []) as BacktestTrade[]);
      return a;
    },
  });

  return (
    <div 
      className="rounded-[20px] flex flex-col group transition-all duration-200" 
      style={{ background: "#080808", border: "1px solid rgba(255,255,255,0.05)", padding: 24 }}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <Link to={`/backtesting/${s.id}`} className="flex-1 min-w-0 block">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base truncate group-hover:text-blue-400 transition-colors">
                {s.name}
              </h3>
              <p className="text-xs text-zinc-500 font-semibold truncate">
                {s.pair ?? "—"} <span className="mx-1.5 opacity-50">•</span> {s.strategy ?? "No strategy"}
              </p>
            </div>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                dup.mutate(s.id, {
                  onSuccess: () => toast({ title: "Session duplicated" }),
                  onError: (e) => toast({ title: "Duplicate failed", description: (e as Error).message, variant: "destructive" }),
                })
              }
            >
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (confirm(`Delete "${s.name}"? This cannot be undone.`)) {
                  del.mutate(s.id, {
                    onSuccess: () => toast({ title: "Session deleted" }),
                  });
                }
              }}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link to={`/backtesting/${s.id}`} className="block mt-2">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Stat label="Trades" value={stats ? String(stats.total) : "—"} />
          <Stat label="Win rate" value={stats ? `${(stats.winRate * 100).toFixed(1)}%` : "—"} />
          <Stat
            label="Net R"
            value={stats ? stats.netR.toFixed(2) : "—"}
            tone={stats ? (stats.netR >= 0 ? "profit" : "loss") : undefined}
          />
          <Stat
            label="P&L"
            value={stats ? stats.totalPnl.toFixed(2) : "—"}
            tone={stats ? (stats.totalPnl >= 0 ? "profit" : "loss") : undefined}
          />
        </div>
        <p className="text-[11px] font-semibold text-zinc-600">
          Created {new Date(s.created_at).toLocaleDateString()}
        </p>
      </Link>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename session</DialogTitle></DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                upd.mutate(
                  { id: s.id, name },
                  {
                    onSuccess: () => {
                      setRenameOpen(false);
                      toast({ title: "Renamed" });
                    },
                  },
                )
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-[20px] border border-zinc-900 bg-[#0b0b0b] px-3.5 py-3 transition-colors group-hover:border-blue-600/[0.35]">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5">{label}</div>
      <div
        className={`font-black text-[15px] ${
          tone === "profit" ? "text-blue-500" : tone === "loss" ? "text-red-500" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function Backtesting() {
  const { data: sessions, isLoading } = useBacktestSessions();
  const create = useCreateSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", pair: "XAUUSD", strategy: "", description: "" });

  return (
    <div className="space-y-6 md:space-y-8 overflow-guard">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title text-foreground flex flex-wrap items-center gap-2 sm:gap-3">
            Strategy Lab
            <span className="text-[10px] bg-warning/15 text-warning font-bold px-2 py-0.5 rounded-md tracking-wider uppercase border border-warning/20">Elite</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1.5 font-medium tracking-wide">
            Manually backtest strategies. Each session is permanently saved with full analytics and AI strategy reports.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[20px] h-11 min-h-[44px] px-4">
              <Plus className="w-4 h-4" /> New session
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0B0B0B] border-zinc-900">
            <DialogHeader><DialogTitle className="text-white">Create backtest session</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-zinc-400">Session name</Label>
                <Input
                  className="bg-[#060606] border-zinc-800 text-white placeholder:text-zinc-600 w-full"
                  placeholder="e.g. XAUUSD London Breakout 2024"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-400">Pair</Label>
                  <Input className="bg-[#060606] border-zinc-800 text-white" value={form.pair} onChange={(e) => setForm({ ...form, pair: e.target.value })} />
                </div>
                <div>
                  <Label className="text-zinc-400">Strategy</Label>
                  <Input
                    className="bg-[#060606] border-zinc-800 text-white placeholder:text-zinc-600"
                    placeholder="e.g. SMC, Trend Following"
                    value={form.strategy}
                    onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-zinc-400">Description</Label>
                <Textarea
                  className="bg-[#060606] border-zinc-800 text-white placeholder:text-zinc-600"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" className="w-full sm:w-auto text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
                disabled={!form.name.trim() || create.isPending}
                onClick={() =>
                  create.mutate(form, {
                    onSuccess: () => {
                      setOpen(false);
                      setForm({ name: "", pair: "XAUUSD", strategy: "", description: "" });
                      toast({ title: "Session created" });
                    },
                    onError: (e) =>
                      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" }),
                  })
                }
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-[20px]" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="rounded-3xl border border-zinc-900 border-dashed bg-[#040404] p-8 sm:p-16 text-center">
          <Sparkles className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1.5">No backtest sessions yet</h3>
          <p className="text-sm text-zinc-500 mb-6 font-medium max-w-md mx-auto">
            Create your first session to start journaling backtests from TradingView.
          </p>
          <Button onClick={() => setOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] h-10 px-6 font-bold">
            <Plus className="w-4 h-4" /> Create session
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((s) => <SessionCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
