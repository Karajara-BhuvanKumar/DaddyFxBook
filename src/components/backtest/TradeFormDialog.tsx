import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeRR,
  computeRGained,
  computePnL,
  EMOTIONS,
  MARKET_CONDITIONS,
  SESSIONS,
  type BacktestTrade,
} from "@/lib/backtest";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  defaultPair?: string;
  initial?: BacktestTrade | null;
  onSave: (input: Partial<BacktestTrade>) => Promise<void> | void;
};

const HTF_TIMEFRAMES = ["Daily", "H4", "H1"] as const;
const LTF_TIMEFRAMES = ["M15", "M5", "M1"] as const;
const CONFIRM_TIMEFRAMES = ["M1", "M5"] as const;
const FIB_TIMEFRAMES = ["Daily", "H4", "H1", "M15", "M5", "M1"] as const;
const LEVEL_TYPES = ["TJL 1", "TJL 2", "SBR", "RBS", "DT", "DB", "QML", "ISS Level 3", "ISS Level 4"] as const;
const CONFIRM_TYPES = ["CC Star", "CC Engulfing", "SBR", "RBS", "QML", "ISS Level 3", "ISS Level 4"] as const;
const CONFLUENCES = ["FIB Zone", "SL Outside Zone", "Liquidity Sweep", "Fib of Zone"] as const;

type StrategySetup = {
  htf_tf: string;
  htf_level: string;
  ltf_tf: string;
  ltf_level: string;
  conf_tf: string;
  conf_type: string;
  confluences: string[];
  fib_tf: string;
};

const emptyStrategy: StrategySetup = {
  htf_tf: "", htf_level: "",
  ltf_tf: "", ltf_level: "",
  conf_tf: "", conf_type: "",
  confluences: [],
  fib_tf: "",
};

const empty = {
  pair: "",
  direction: "long" as "long" | "short",
  entry_price: "",
  stop_loss: "",
  take_profit: "",
  exit_price: "",
  rr: "",
  r_gained: "",
  pnl: "",
  outcome: "win" as "win" | "loss" | "breakeven",
  setup: "",
  session: "",
  market_condition: "",
  emotion: "",
  notes: "",
  trade_date: new Date().toISOString().slice(0, 10),
  screenshot_url: "",
};

function buildSummary(s: StrategySetup): string {
  const lines: string[] = [];
  if (s.htf_tf || s.htf_level) lines.push(`HTF: ${[s.htf_tf, s.htf_level].filter(Boolean).join(" ")}`);
  if (s.ltf_tf || s.ltf_level) lines.push(`LTF: ${[s.ltf_tf, s.ltf_level].filter(Boolean).join(" ")}`);
  if (s.conf_tf || s.conf_type) lines.push(`Confirmation: ${[s.conf_tf, s.conf_type].filter(Boolean).join(" ")}`);
  if (s.confluences.length) {
    lines.push("");
    lines.push("Confluences:");
    s.confluences.forEach((c) => {
      lines.push(c === "FIB Zone" && s.fib_tf ? `✓ FIB Zone (${s.fib_tf})` : `✓ ${c}`);
    });
  }
  return lines.join("\n");
}

function parseSummary(text: string): StrategySetup {
  // Best-effort parse so existing trades open with their strategy populated
  const s: StrategySetup = { ...emptyStrategy };
  if (!text) return s;
  const lines = text.split("\n");
  const parseTwo = (rest: string, tfs: readonly string[], levels: readonly string[]) => {
    const tf = tfs.find((t) => rest.startsWith(t + " ") || rest === t) ?? "";
    const remaining = tf ? rest.slice(tf.length).trim() : rest;
    const level = levels.find((l) => remaining === l) ?? "";
    return { tf, level };
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("HTF:")) {
      const r = parseTwo(trimmed.slice(4).trim(), HTF_TIMEFRAMES, LEVEL_TYPES);
      s.htf_tf = r.tf; s.htf_level = r.level;
    } else if (trimmed.startsWith("LTF:")) {
      const r = parseTwo(trimmed.slice(4).trim(), LTF_TIMEFRAMES, LEVEL_TYPES);
      s.ltf_tf = r.tf; s.ltf_level = r.level;
    } else if (trimmed.startsWith("Confirmation:")) {
      const r = parseTwo(trimmed.slice(13).trim(), CONFIRM_TIMEFRAMES, CONFIRM_TYPES);
      s.conf_tf = r.tf; s.conf_type = r.level;
    } else if (trimmed.startsWith("✓")) {
      const rest = trimmed.slice(1).trim();
      const fibMatch = rest.match(/^FIB Zone \(([^)]+)\)$/);
      if (fibMatch) {
        if (!s.confluences.includes("FIB Zone")) s.confluences.push("FIB Zone");
        s.fib_tf = fibMatch[1];
      } else if ((CONFLUENCES as readonly string[]).includes(rest)) {
        if (!s.confluences.includes(rest)) s.confluences.push(rest);
      }
    }
  }
  return s;
}

export default function TradeFormDialog({
  open,
  onOpenChange,
  sessionId,
  defaultPair,
  initial,
  onSave,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...empty, pair: defaultPair ?? "" });
  const [strategy, setStrategy] = useState<StrategySetup>(emptyStrategy);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        pair: initial.pair,
        direction: initial.direction,
        entry_price: initial.entry_price?.toString() ?? "",
        stop_loss: initial.stop_loss?.toString() ?? "",
        take_profit: initial.take_profit?.toString() ?? "",
        exit_price: initial.exit_price?.toString() ?? "",
        rr: initial.rr?.toString() ?? "",
        r_gained: initial.r_gained?.toString() ?? "",
        pnl: initial.pnl?.toString() ?? "",
        outcome: initial.outcome,
        setup: initial.setup ?? "",
        session: initial.session ?? "",
        market_condition: initial.market_condition ?? "",
        emotion: initial.emotion ?? "",
        notes: initial.notes ?? "",
        trade_date: initial.trade_date ?? new Date().toISOString().slice(0, 10),
        screenshot_url: initial.screenshot_url ?? "",
      });
      setStrategy(parseSummary(initial.setup ?? ""));
    } else {
      setForm({ ...empty, pair: defaultPair ?? "" });
      setStrategy(emptyStrategy);
    }
    setStep(1);
  }, [initial, defaultPair, open]);

  const summary = useMemo(() => buildSummary(strategy), [strategy]);

  const updateAndRecalc = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch };
    const e = parseFloat(next.entry_price);
    const s = parseFloat(next.stop_loss);
    const t = parseFloat(next.take_profit);
    const x = parseFloat(next.exit_price);

    let rr = next.rr;
    let r_gained = next.r_gained;
    let pnl = next.pnl;
    let outcome: "win" | "loss" | "breakeven" = next.outcome;

    const hasEntry = !Number.isNaN(e) && next.entry_price !== "";
    const hasSL = !Number.isNaN(s) && next.stop_loss !== "";
    const hasTP = !Number.isNaN(t) && next.take_profit !== "";
    const hasExit = !Number.isNaN(x) && next.exit_price !== "";

    if (hasEntry && hasSL && hasTP) {
      rr = String(computeRR(e, s, t, next.direction));
    } else if (!hasEntry || !hasSL || !hasTP) {
      rr = "";
    }

    if (hasEntry && hasSL && hasExit) {
      const risk = next.direction === "long" ? e - s : s - e;
      if (risk > 0) {
        r_gained = String(computeRGained(e, s, x, next.direction));
        pnl = String(computePnL(e, x, next.direction));
        const pnlNum = parseFloat(pnl);
        if (pnlNum > 0) outcome = "win";
        else if (pnlNum < 0) outcome = "loss";
        else outcome = "breakeven";
      } else {
        r_gained = ""; pnl = ""; outcome = "breakeven";
      }
    } else {
      r_gained = ""; pnl = ""; outcome = "breakeven";
    }

    setForm({ ...next, rr, r_gained, pnl, outcome });
  };

  const updateStrategy = (patch: Partial<StrategySetup>) => {
    setStrategy((prev) => {
      const next = { ...prev, ...patch };
      if (!next.confluences.includes("FIB Zone")) next.fib_tf = "";
      return next;
    });
  };

  const toggleConfluence = (c: string) => {
    setStrategy((prev) => {
      const has = prev.confluences.includes(c);
      const confluences = has ? prev.confluences.filter((x) => x !== c) : [...prev.confluences, c];
      return { ...prev, confluences, fib_tf: confluences.includes("FIB Zone") ? prev.fib_tf : "" };
    });
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");
      const path = `${userRes.user.id}/${sessionId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("screenshots").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      setForm((f) => ({ ...f, screenshot_url: signed?.signedUrl ?? path }));
      toast({ title: "Screenshot uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.pair.trim()) {
      toast({ title: "Pair is required", variant: "destructive" });
      setStep(1);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        pair: form.pair.trim().toUpperCase(),
        direction: form.direction,
        entry_price: form.entry_price ? parseFloat(form.entry_price) : null,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
        exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
        rr: form.rr ? parseFloat(form.rr) : null,
        r_gained: form.r_gained ? parseFloat(form.r_gained) : null,
        pnl: form.pnl ? parseFloat(form.pnl) : null,
        outcome: form.outcome,
        setup: summary || null,
        session: form.session || null,
        market_condition: form.market_condition || null,
        emotion: form.emotion || null,
        notes: form.notes || null,
        trade_date: form.trade_date || null,
        screenshot_url: form.screenshot_url || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const pnlClass = (() => {
    if (!form.pnl) return "text-muted-foreground";
    const n = parseFloat(form.pnl);
    if (n > 0) return "text-profit";
    if (n < 0) return "text-loss";
    return "text-muted-foreground";
  })();

  const invalidRisk = (() => {
    const e = parseFloat(form.entry_price);
    const s = parseFloat(form.stop_loss);
    if (Number.isNaN(e) || Number.isNaN(s) || !form.entry_price || !form.stop_loss) return false;
    const risk = form.direction === "long" ? e - s : s - e;
    return risk <= 0;
  })();

  const steps = [
    { n: 1, label: "Trade Details" },
    { n: 2, label: "Strategy Setup" },
    { n: 3, label: "Psychology & Notes" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit trade" : "Add backtest trade"}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-2">
          {steps.map((s, idx) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => setStep(s.n as 1 | 2 | 3)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full",
                  step === s.n
                    ? "bg-primary/15 text-primary border border-primary/40"
                    : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                )}
              >
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  step === s.n ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"
                )}>{s.n}</span>
                <span className="truncate">{s.label}</span>
              </button>
              {idx < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pair</Label>
                <Input value={form.pair} onChange={(e) => updateAndRecalc({ pair: e.target.value })} />
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={form.direction} onValueChange={(v) => updateAndRecalc({ direction: v as "long" | "short" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entry price</Label>
                <Input type="number" step="any" value={form.entry_price} onChange={(e) => updateAndRecalc({ entry_price: e.target.value })} />
              </div>
              <div>
                <Label>Stop loss</Label>
                <Input type="number" step="any" value={form.stop_loss} onChange={(e) => updateAndRecalc({ stop_loss: e.target.value })} />
              </div>
              <div>
                <Label>Take profit</Label>
                <Input type="number" step="any" value={form.take_profit} onChange={(e) => updateAndRecalc({ take_profit: e.target.value })} />
              </div>
              <div>
                <Label>Exit price</Label>
                <Input type="number" step="any" value={form.exit_price} onChange={(e) => updateAndRecalc({ exit_price: e.target.value })} />
              </div>
              <div>
                <Label>Risk : Reward</Label>
                <Input type="number" step="any" readOnly value={form.rr} />
              </div>
              <div>
                <Label>R gained</Label>
                <Input type="number" step="any" readOnly value={form.r_gained} />
                {invalidRisk && <p className="text-xs text-destructive mt-1">Invalid risk</p>}
              </div>
              <div>
                <Label>P&L</Label>
                <Input type="number" step="any" readOnly value={form.pnl} className={cn(pnlClass)} />
              </div>
              <div>
                <Label>Outcome</Label>
                <div className="h-10 flex items-center">
                  <Badge className={cn(
                    "capitalize",
                    form.outcome === "win"
                      ? "bg-profit text-white border-transparent hover:bg-profit/80"
                      : form.outcome === "loss"
                      ? "bg-loss text-white border-transparent hover:bg-loss/80"
                      : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                  )}>
                    {form.outcome === "win" ? "Win" : form.outcome === "loss" ? "Loss" : "Break-even"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.trade_date} onChange={(e) => updateAndRecalc({ trade_date: e.target.value })} />
              </div>
              <div>
                <Label>Session</Label>
                <Select value={form.session} onValueChange={(v) => updateAndRecalc({ session: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {SESSIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <StrategyCard title="HTF Structure" example={`${strategy.htf_tf || "—"} | ${strategy.htf_level || "—"}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Timeframe</Label>
                  <Select value={strategy.htf_tf} onValueChange={(v) => updateStrategy({ htf_tf: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{HTF_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level Type</Label>
                  <Select value={strategy.htf_level} onValueChange={(v) => updateStrategy({ htf_level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{LEVEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </StrategyCard>

            <StrategyCard title="LTF Structure" example={`${strategy.ltf_tf || "—"} | ${strategy.ltf_level || "—"}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Timeframe</Label>
                  <Select value={strategy.ltf_tf} onValueChange={(v) => updateStrategy({ ltf_tf: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{LTF_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level Type</Label>
                  <Select value={strategy.ltf_level} onValueChange={(v) => updateStrategy({ ltf_level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{LEVEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </StrategyCard>

            <StrategyCard title="Confirmation" example={`${strategy.conf_tf || "—"} | ${strategy.conf_type || "—"}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Timeframe</Label>
                  <Select value={strategy.conf_tf} onValueChange={(v) => updateStrategy({ conf_tf: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{CONFIRM_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={strategy.conf_type} onValueChange={(v) => updateStrategy({ conf_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{CONFIRM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </StrategyCard>

            <StrategyCard title="Confluences">
              <div className="flex flex-wrap gap-2">
                {CONFLUENCES.map((c) => {
                  const active = strategy.confluences.includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => toggleConfluence(c)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
                        active
                          ? "bg-primary/15 text-primary border-primary/50"
                          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                      )}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      {c}
                    </button>
                  );
                })}
              </div>
              {strategy.confluences.includes("FIB Zone") && (
                <div className="mt-3 max-w-xs">
                  <Label>FIB Zone Timeframe</Label>
                  <Select value={strategy.fib_tf} onValueChange={(v) => updateStrategy({ fib_tf: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{FIB_TIMEFRAMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </StrategyCard>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="text-xs uppercase tracking-wider text-primary/80 mb-2">Setup Summary</div>
              {summary ? (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">{summary}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">Fill the cards above to generate a summary.</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Market condition</Label>
                <Select value={form.market_condition} onValueChange={(v) => updateAndRecalc({ market_condition: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {MARKET_CONDITIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emotion</Label>
                <Select value={form.emotion} onValueChange={(v) => updateAndRecalc({ emotion: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={4} value={form.notes} onChange={(e) => updateAndRecalc({ notes: e.target.value })} />
            </div>
            <div>
              <Label>Screenshot</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              {form.screenshot_url && (
                <a href={form.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                  View attached screenshot
                </a>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((step + 1) as 1 | 2 | 3)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={saving}>
                {saving ? "Saving…" : initial ? "Save changes" : "Add trade"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StrategyCard({
  title,
  example,
  children,
}: {
  title: string;
  example?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {example && <span className="text-xs font-mono text-muted-foreground">{example}</span>}
      </div>
      {children}
    </div>
  );
}
