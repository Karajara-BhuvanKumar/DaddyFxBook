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
    <div className="rounded-xl border border-border/60 bg-card/60 p-5 hover:border-primary/40 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Link to={`/backtesting/${s.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {s.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {s.pair ?? "—"} · {s.strategy ?? "No strategy"}
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

      <Link to={`/backtesting/${s.id}`} className="block">
        <div className="grid grid-cols-2 gap-2 text-xs">
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
        <p className="text-[11px] text-muted-foreground mt-3">
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
    <div className="rounded-md bg-background/40 border border-border/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-sm font-semibold ${
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground"
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Strategy Lab</h1>
            <span className="badge-pill bg-warning/15 text-warning">ELITE</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manually backtest strategies. Each session is permanently saved with full analytics and AI strategy reports.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create backtest session</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Session name</Label>
                <Input
                  placeholder="e.g. XAUUSD London Breakout 2024"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pair</Label>
                  <Input value={form.pair} onChange={(e) => setForm({ ...form, pair: e.target.value })} />
                </div>
                <div>
                  <Label>Strategy</Label>
                  <Input
                    placeholder="e.g. SMC, Trend Following"
                    value={form.strategy}
                    onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
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
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No backtest sessions yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first session to start journaling backtests from TradingView.
          </p>
          <Button onClick={() => setOpen(true)} className="gap-2">
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
