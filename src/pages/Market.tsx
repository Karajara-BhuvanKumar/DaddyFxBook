import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Search, Sparkles, BookOpen, TrendingUp, TrendingDown, Activity, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

type MarketEvent = {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  currency: string;
  impact: "high" | "medium" | "low" | "holiday";
  timeUTC: string;
  forecast: string;
  previous: string;
  actual: string;
};

type Analysis = {
  explanation: {
    what_it_measures: string;
    why_traders_care: string;
    markets_affected: string[];
    why_volatility_increases: string;
  };
  bias_prediction: {
    scenario: string;
    usd_bias: string;
    gold_bias: string;
    equities_bias: string;
    confidence: string;
    reasoning: string;
  };
  asset_impact: Record<string, { direction: string; strength: string; note: string }>;
  educational: {
    indicator_meaning: string;
    why_it_matters: string;
    how_institutions_react: string;
    behavior_before_release: string;
    behavior_after_release: string;
    common_mistakes: string[];
    beginners_should_avoid: boolean;
    beginners_reason: string;
  };
  how_to_trade: { before: string[]; during: string[]; after: string[] };
  historical_behavior: string[];
  warnings: string[];
};

const IMPACT_ORDER = { high: 0, medium: 1, low: 2, holiday: 3 } as const;

function impactBadge(impact: MarketEvent["impact"]) {
  if (impact === "high")
    return <Badge className="bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/20">HIGH</Badge>;
  if (impact === "medium")
    return <Badge className="bg-warning/15 text-warning border-warning/40 hover:bg-warning/20">MED</Badge>;
  if (impact === "holiday")
    return <Badge variant="outline" className="text-muted-foreground">HOLIDAY</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">LOW</Badge>;
}

function formatTime(iso: string, tz: "UTC" | "IST") {
  const d = new Date(iso);
  if (tz === "UTC") {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

function isSameDay(iso: string, day: Date) {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === day.getUTCFullYear() &&
    d.getUTCMonth() === day.getUTCMonth() &&
    d.getUTCDate() === day.getUTCDate()
  );
}

function biasColor(bias: string) {
  if (bias === "bullish") return "text-profit";
  if (bias === "bearish") return "text-destructive";
  if (bias === "high_volatility") return "text-warning";
  if (bias === "sideways") return "text-muted-foreground";
  return "text-muted-foreground";
}

function biasIcon(bias: string) {
  if (bias === "bullish") return <TrendingUp className="w-3.5 h-3.5" />;
  if (bias === "bearish") return <TrendingDown className="w-3.5 h-3.5" />;
  if (bias === "high_volatility") return <Activity className="w-3.5 h-3.5" />;
  return <span className="w-3.5 h-3.5 inline-block">–</span>;
}

const LEARNING_TOPICS = [
  { title: "Inflation (CPI / PPI)", body: "Inflation tracks the change in the price of goods and services. Rising inflation typically pushes central banks toward tighter policy (higher rates), supporting the local currency and pressuring gold and growth stocks." },
  { title: "Interest Rates", body: "The cost of borrowing money set by central banks. Higher rates strengthen a currency by attracting capital, but they pressure equities, gold and risk assets." },
  { title: "Employment (NFP / Jobless Claims)", body: "Employment data reveals economic health. Strong jobs growth = hawkish central bank = stronger USD. Weak jobs = dovish bias and weaker USD." },
  { title: "GDP", body: "Gross Domestic Product measures total economic output. Better-than-expected GDP typically strengthens the currency and equities; misses do the opposite." },
  { title: "Central Banks", body: "FOMC, ECB, BoE, BoJ etc. set monetary policy. Their statements, dot-plots and press conferences are the highest-impact events in macro trading." },
  { title: "Monetary Policy", body: "Tools used by central banks: rate decisions, QE/QT, forward guidance. Hawkish = tighter; Dovish = looser. Markets price expectations weeks ahead." },
  { title: "Risk-On vs Risk-Off", body: "Risk-on: equities, AUD, NZD, BTC rally; JPY, CHF, gold lag. Risk-off: capital flees to USD, JPY, CHF, gold and bonds." },
  { title: "Yield Relationships", body: "Higher US yields usually strengthen USD and weigh on gold. Falling yields tend to support gold and risk assets. Watch the 2Y and 10Y." },
];

export default function Market() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<MarketEvent | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Record<string, Analysis>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke("market-events");
        if (error) throw error;
        if (alive) setEvents((data?.events as MarketEvent[]) ?? []);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const currencies = useMemo(
    () => Array.from(new Set(events.map((e) => e.currency).filter(Boolean))).sort(),
    [events],
  );
  const countries = useMemo(
    () => Array.from(new Set(events.map((e) => e.country).filter(Boolean))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const dayDate = filterDate ? new Date(`${filterDate}T00:00:00Z`) : null;
    return events
      .filter((e) => (dayDate ? isSameDay(e.timeUTC, dayDate) : true))
      .filter((e) => (filterCurrency === "all" ? true : e.currency === filterCurrency))
      .filter((e) => (filterCountry === "all" ? true : e.country === filterCountry))
      .filter((e) => (filterImpact === "all" ? true : e.impact === filterImpact))
      .filter((e) =>
        search.trim() ? e.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
      )
      .sort((a, b) => {
        const t = new Date(a.timeUTC).getTime() - new Date(b.timeUTC).getTime();
        if (t !== 0) return t;
        return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
      });
  }, [events, filterDate, filterCurrency, filterCountry, filterImpact, search]);

  const highImpactToday = useMemo(() => {
    const today = new Date();
    return events.filter(
      (e) => e.impact === "high" && isSameDay(e.timeUTC, new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))),
    ).length;
  }, [events]);

  const upcomingHighImpact = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.impact === "high")
      .map((e) => ({ e, diffMin: (new Date(e.timeUTC).getTime() - now) / 60000 }))
      .filter((x) => x.diffMin > 0 && x.diffMin <= 60)
      .sort((a, b) => a.diffMin - b.diffMin)[0];
  }, [events]);

  async function openEvent(e: MarketEvent) {
    setSelected(e);
    setAnalysis(null);
    if (analysisCache[e.id]) {
      setAnalysis(analysisCache[e.id]);
      return;
    }
    try {
      setAnalysisLoading(true);
      const { data, error } = await supabase.functions.invoke("market-ai", { body: e });
      if (error) throw error;
      if (!data?.analysis) throw new Error("No analysis returned");
      setAnalysis(data.analysis);
      setAnalysisCache((c) => ({ ...c, [e.id]: data.analysis }));
    } catch (err) {
      toast.error("AI analysis failed", { description: (err as Error).message });
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {upcomingHighImpact && (
        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            High-impact news in {Math.round(upcomingHighImpact.diffMin)} minutes
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {upcomingHighImpact.e.title} ({upcomingHighImpact.e.currency}) — consider reducing risk,
            expect increased volatility, avoid tight stop losses.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Today's Events" value={loading ? "…" : filtered.length.toString()} icon={<CalendarIcon className="w-4 h-4" />} />
        <StatCard label="High Impact Today" value={loading ? "…" : highImpactToday.toString()} icon={<AlertTriangle className="w-4 h-4 text-destructive" />} accent="destructive" />
        <StatCard label="Currencies Tracked" value={loading ? "…" : currencies.length.toString()} icon={<Activity className="w-4 h-4 text-primary" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" /> Economic Calendar
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Click any event to unlock AI explanation, bias prediction, asset impact and trading playbook.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {currencies.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterCountry} onValueChange={setFilterCountry}>
              <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterImpact} onValueChange={setFilterImpact}>
              <SelectTrigger><SelectValue placeholder="Impact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All impact</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn't load calendar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No events match these filters. Try widening the date or impact filter.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[80px]">Impact</TableHead>
                    <TableHead className="w-[90px]">UTC</TableHead>
                    <TableHead className="w-[90px]">IST</TableHead>
                    <TableHead className="w-[70px]">Cur</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="w-[90px] text-right">Actual</TableHead>
                    <TableHead className="w-[90px] text-right">Forecast</TableHead>
                    <TableHead className="w-[90px] text-right">Previous</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow
                      key={e.id}
                      className={`cursor-pointer ${e.impact === "high" ? "bg-destructive/[0.04] hover:bg-destructive/10" : "hover:bg-accent/30"}`}
                      onClick={() => openEvent(e)}
                    >
                      <TableCell>{impactBadge(e.impact)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(e.timeUTC, "UTC")}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(e.timeUTC, "IST")}</TableCell>
                      <TableCell className="font-semibold">{e.currency}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{e.title}</div>
                        <div className="text-[11px] text-muted-foreground">{e.country}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{e.actual || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{e.forecast || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{e.previous || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> AI Learning Center
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Beginner-friendly explanations of the macro concepts that move markets.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LEARNING_TOPICS.map((t) => (
              <div key={t.title} className="rounded-lg border border-border/60 bg-card/40 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1.5">{t.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-1">
                  {impactBadge(selected.impact)}
                  <Badge variant="outline" className="text-xs">{selected.currency}</Badge>
                  <span className="text-xs text-muted-foreground">{selected.country}</span>
                </div>
                <SheetTitle className="text-xl">{selected.title}</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  UTC {formatTime(selected.timeUTC, "UTC")} · IST {formatTime(selected.timeUTC, "IST")}
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <MiniStat label="Actual" value={selected.actual || "—"} highlight />
                <MiniStat label="Forecast" value={selected.forecast || "—"} />
                <MiniStat label="Previous" value={selected.previous || "—"} />
              </div>

              {selected.impact === "high" && (
                <Alert className="mt-4 border-destructive/40 bg-destructive/5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertTitle className="text-destructive">High-impact event</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Expect sharp moves, wider spreads, and possible fake breakouts. Reduce size and widen stops.
                  </AlertDescription>
                </Alert>
              )}

              <div className="mt-5">
                {analysisLoading && (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                )}
                {!analysisLoading && analysis && (
                  <Tabs defaultValue="explain" className="w-full">
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="explain">Explain</TabsTrigger>
                      <TabsTrigger value="bias">Bias</TabsTrigger>
                      <TabsTrigger value="assets">Assets</TabsTrigger>
                      <TabsTrigger value="trade">Trade</TabsTrigger>
                      <TabsTrigger value="learn">Learn</TabsTrigger>
                    </TabsList>

                    <TabsContent value="explain" className="space-y-3 mt-4">
                      <Block title="What it measures" body={analysis.explanation.what_it_measures} />
                      <Block title="Why traders care" body={analysis.explanation.why_traders_care} />
                      <Block title="Why volatility increases" body={analysis.explanation.why_volatility_increases} />
                      <div className="rounded-lg border bg-card/40 p-3">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5">Markets affected</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.explanation.markets_affected.map((m) => (
                            <Badge key={m} variant="outline">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="bias" className="space-y-3 mt-4">
                      <div className="rounded-lg border bg-card/40 p-4">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground">Scenario</p>
                        <p className="text-sm text-foreground mt-1">{analysis.bias_prediction.scenario}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <BiasCard label="USD" bias={analysis.bias_prediction.usd_bias} />
                        <BiasCard label="Gold" bias={analysis.bias_prediction.gold_bias} />
                        <BiasCard label="Equities" bias={analysis.bias_prediction.equities_bias} />
                      </div>
                      <div className="rounded-lg border bg-card/40 p-3">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">Confidence</p>
                        <Badge className="capitalize">{analysis.bias_prediction.confidence}</Badge>
                        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                          {analysis.bias_prediction.reasoning}
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="assets" className="space-y-2 mt-4">
                      {Object.entries(analysis.asset_impact).map(([k, v]) => (
                        <div key={k} className="rounded-lg border bg-card/40 p-3 flex items-start gap-3">
                          <div className="w-20 shrink-0">
                            <p className="text-sm font-semibold text-foreground">{k}</p>
                            <p className="text-[10px] uppercase text-muted-foreground">{v.strength} impact</p>
                          </div>
                          <div className="flex-1">
                            <div className={`flex items-center gap-1.5 text-xs font-medium capitalize ${biasColor(v.direction)}`}>
                              {biasIcon(v.direction)} {v.direction.replace("_", " ")}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{v.note}</p>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="trade" className="space-y-3 mt-4">
                      <Playbook title="Before the news" items={analysis.how_to_trade.before} />
                      <Playbook title="During the news" items={analysis.how_to_trade.during} />
                      <Playbook title="After the news" items={analysis.how_to_trade.after} />
                      {analysis.warnings?.length > 0 && (
                        <Alert className="border-warning/40 bg-warning/5">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertTitle className="text-warning">AI Warnings</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc pl-4 mt-1 space-y-1 text-xs text-muted-foreground">
                              {analysis.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </TabsContent>

                    <TabsContent value="learn" className="space-y-3 mt-4">
                      <Block title="Indicator meaning" body={analysis.educational.indicator_meaning} />
                      <Block title="Why it matters" body={analysis.educational.why_it_matters} />
                      <Block title="How institutions react" body={analysis.educational.how_institutions_react} />
                      <Block title="Behavior before release" body={analysis.educational.behavior_before_release} />
                      <Block title="Behavior after release" body={analysis.educational.behavior_after_release} />
                      <div className="rounded-lg border bg-card/40 p-3">
                        <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Common mistakes</p>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                          {analysis.educational.common_mistakes.map((m, i) => (<li key={i}>{m}</li>))}
                        </ul>
                      </div>
                      <Alert className={analysis.educational.beginners_should_avoid ? "border-destructive/40 bg-destructive/5" : "border-profit/40 bg-profit/5"}>
                        <AlertTitle className={analysis.educational.beginners_should_avoid ? "text-destructive" : "text-profit"}>
                          {analysis.educational.beginners_should_avoid ? "Beginners: Avoid trading this event" : "Beginners: Tradeable with caution"}
                        </AlertTitle>
                        <AlertDescription className="text-xs text-muted-foreground">
                          {analysis.educational.beginners_reason}
                        </AlertDescription>
                      </Alert>
                      {analysis.historical_behavior?.length > 0 && (
                        <div className="rounded-lg border bg-card/40 p-3">
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Historical behavior</p>
                          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                            {analysis.historical_behavior.map((h, i) => (<li key={i}>{h}</li>))}
                          </ul>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
                {!analysisLoading && !analysis && (
                  <div className="text-center py-8">
                    <Button onClick={() => openEvent(selected)} className="gap-2">
                      <Sparkles className="w-4 h-4" /> Generate AI Analysis
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${accent === "destructive" ? "text-destructive" : "text-foreground"}`}>{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center">{icon}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? "border-primary/40 bg-primary/5" : "bg-card/40"}`}>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="text-base font-mono font-semibold mt-1">{value}</p>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-foreground/90 leading-relaxed">{body}</p>
    </div>
  );
}

function BiasCard({ label, bias }: { label: string; bias: string }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3 text-center">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <div className={`mt-1.5 flex items-center justify-center gap-1.5 text-sm font-semibold capitalize ${biasColor(bias)}`}>
        {biasIcon(bias)} {bias.replace("_", " ")}
      </div>
    </div>
  );
}

function Playbook({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-card/40 p-3">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">{title}</p>
      <ul className="list-disc pl-4 space-y-1 text-xs text-foreground/90">
        {items.map((it, i) => (<li key={i}>{it}</li>))}
      </ul>
    </div>
  );
}
