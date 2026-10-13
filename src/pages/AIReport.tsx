import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BarChart3, BookOpen, Check, ChevronDown, Copy, Download, FileSearch, History, Loader2, Plug, RefreshCw, Settings2, ShieldCheck, Target, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { IncludeFlags } from "@/lib/ai";
import { fetchCoachData } from "@/lib/coach/data";
import { analyzeCoachData } from "@/lib/coach/analysis";
import { resolveCoachWindow } from "@/lib/coach/period";
import { DEFAULT_SOURCES, SOURCE_LABELS, type Period } from "@/lib/coach/types";
import { buildCoachPrompt, COACH_SYSTEM, coachReportToText, parseCoachReport, readSavedReviews, saveReview, type SavedCoachReport } from "@/lib/coach/report";
import { CoachConnectionError, generateCoachReview, getCoachProviderStatus } from "@/lib/coach/provider";
import { CoachReview, ProcessMeasures } from "@/components/coach/CoachReview";
import "@/styles/performance-coach.css";

const LegacyScorecards = lazy(() => import("@/components/ai-report/ScorecardTab").then(module => ({ default: module.ScorecardTab })));
const PERIODS: Period[] = ["Daily", "Weekly", "Monthly", "Custom", "All Time"];
const readStorage = (key: string) => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };

export default function AIReportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id || "";
  const [period, setPeriod] = useState<Period>("Weekly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOf, setAsOf] = useState(() => new Date());
  const [include, setInclude] = useState<IncludeFlags>({ ...DEFAULT_SOURCES });
  const [instructions, setInstructions] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [report, setReport] = useState<SavedCoachReport | null>(null);
  const [savedReviews, setSavedReviews] = useState<SavedCoachReport[]>([]);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const controller = useRef<AbortController | null>(null);
  const reportTop = useRef<HTMLDivElement>(null);
  const activeUser = useRef(uid);
  activeUser.current = uid;
  const dataQuery = useQuery({ queryKey: ["performance-coach-data", uid], enabled: !!uid, queryFn: ({ signal }) => fetchCoachData(uid, signal), staleTime: 60_000, retry: false });
  const providerQuery = useQuery({ queryKey: ["performance-coach-provider", uid], enabled: !!uid, queryFn: getCoachProviderStatus, staleTime: 60_000, retry: false });

  useEffect(() => {
    // Retire browser-stored API keys from the previous direct-OpenRouter integration.
    try { localStorage.removeItem(`dfb-coach-key:${uid}`); localStorage.removeItem("openrouter_api_key"); } catch { /* storage may be unavailable */ }
    setInstructions(readStorage(`dfb-coach-focus:${uid}`) || readStorage("ai_report_instructions"));
    const reviews = uid ? readSavedReviews(uid) : [];
    setSavedReviews(reviews); setReport(reviews[0] || null);
    setError(""); setRetryable(false); setStorageWarning(""); setGenerating(false);
    return () => { controller.current?.abort(); };
  }, [uid]);

  const range = useMemo(() => {
    try { return { value: resolveCoachWindow(period, from, to, asOf), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "Check your dates." }; }
  }, [period, from, to, asOf]);
  const analysis = useMemo(() => dataQuery.data && range.value ? analyzeCoachData(dataQuery.data, range.value, include) : null, [dataQuery.data, range.value, include]);
  const sourceCount = Object.values(include).filter(Boolean).length;

  async function generate() {
    if (controller.current || !uid) return;
    if (!providerQuery.data?.ready) { setConnectionOpen(true); return; }
    if (!range.value || !sourceCount) return;
    const abort = new AbortController(); controller.current = abort;
    setGenerating(true); setError(""); setRetryable(false); setStorageWarning(""); setStage("Reading your selected trading records…");
    try {
      const window = resolveCoachWindow(period, from, to, new Date());
      const fresh = await fetchCoachData(uid, abort.signal);
      if (abort.signal.aborted || activeUser.current !== uid) return;
      queryClient.setQueryData(["performance-coach-data", uid], fresh);
      const context = analyzeCoachData(fresh, window, include);
      if (!context.tradeCount) throw new Error("There are no trades in this period. Choose a wider range or add your first trade.");
      setStage("Reviewing performance, journal context, and recurring patterns…");
      const result = await generateCoachReview(buildCoachPrompt(context, instructions), COACH_SYSTEM, abort.signal);
      if (abort.signal.aborted) return;
      setStage("Checking report structure and evidence references…");
      const structured = parseCoachReport(result.report, context);
      const saved: SavedCoachReport = { version: 1, id: crypto.randomUUID(), generatedAt: result.timestamp, report: structured, analysis: context, instructions: instructions.trim() };
      if (activeUser.current !== uid) return;
      setReport(saved); setAsOf(new Date(window.end));
      try { setSavedReviews(saveReview(uid, saved)); localStorage.setItem(`dfb-coach-focus:${uid}`, instructions.trim()); }
      catch { setStorageWarning("Your review is ready, but this browser couldn't save it. Download a copy to keep it."); }
      toast.success("Your performance review is ready.");
      requestAnimationFrame(() => { reportTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }); reportTop.current?.focus({ preventScroll: true }); });
    } catch (error) {
      if (!abort.signal.aborted) { setError(error instanceof Error ? error.message : "Couldn't complete the review. Please try again."); setRetryable(error instanceof CoachConnectionError ? error.retryable : false); }
    } finally { if (controller.current === abort) { controller.current = null; setGenerating(false); setStage(""); } }
  }
  function cancel() { controller.current?.abort(); setGenerating(false); setStage(""); }
  async function copyReport() {
    if (!report) return;
    try { await navigator.clipboard.writeText(coachReportToText(report)); toast.success("Review copied with supporting evidence."); }
    catch { toast.error("Couldn't access the clipboard. Download the review instead."); }
  }
  function downloadReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([coachReportToText(report)], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `DaddyFXBook-Performance-Review-${report.generatedAt.slice(0, 10)}.txt`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="pc-page">
    <header className="pc-header"><div><div className="pc-eyebrow"><span />YOUR EDGE STARTS WITH UNDERSTANDING</div><h1>Performance Coach</h1><p>Understand the pattern. Improve the process.</p></div><div className="pc-header-actions"><Button variant="outline" onClick={() => setHistoryOpen(true)}><History size={15} />Past reviews{savedReviews.length > 0 && <span className="pc-count">{savedReviews.length}</span>}</Button><Button variant="ghost" disabled={generating} onClick={() => setConnectionOpen(true)}><span className={`pc-connection-dot ${providerQuery.data?.ready ? "is-connected" : ""}`} />{providerQuery.data?.ready ? "Coach ready" : "Coach status"}<Settings2 size={14} /></Button></div></header>

    <section className="pc-builder" aria-label="Review setup"><fieldset disabled={generating}>
      <div className="pc-builder-top"><div><span className="pc-kicker">YOUR REVIEW WINDOW</span><div className="pc-periods" role="group" aria-label="Report period">{PERIODS.map(p => <button key={p} type="button" aria-pressed={period === p} onClick={() => { setPeriod(p); setAsOf(new Date()); }}>{p}</button>)}</div></div><Button className="pc-generate" onClick={generate} disabled={generating || dataQuery.isPending || !range.value || !sourceCount || !uid || !analysis?.tradeCount}>{generating ? <Loader2 size={17} className="animate-spin" /> : <FileSearch size={17} />}{generating ? "Preparing your review…" : "Generate Performance Report"}{!generating && <ArrowRight size={16} />}</Button></div>
      {period === "Custom" && <div className="pc-custom-dates"><div><Label htmlFor="coach-from">From</Label><Input id="coach-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div><div><Label htmlFor="coach-to">Through</Label><Input id="coach-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></div><span>Includes the end date through now.</span></div>}
      <div className="pc-window-caption">{range.value ? <><span>{period === "Daily" ? "Last 24 hours" : period === "Weekly" ? "Last 7 days" : period === "Monthly" ? "Last 30 days" : period === "All Time" ? "Complete available history" : "Custom date range"}</span><span>{range.value.label} · {range.value.timezone}</span></> : <span role="alert">{range.error}</span>}</div>
      <details className="pc-options"><summary><span><Settings2 size={14} />Customize analysis <small>{sourceCount} sources · optional focus</small></span><ChevronDown size={15} /></summary><div className="pc-options-body"><div><h3>Give your coach the right context</h3><p className="pc-muted pc-small">Only checked sources and their derived metrics are included. Trades still define the date window when performance data is unchecked.</p><div className="pc-source-options">{Object.entries(SOURCE_LABELS).map(([name, label]) => <label key={name}><input type="checkbox" checked={include[name as keyof IncludeFlags]} onChange={e => setInclude(prev => ({ ...prev, [name]: e.target.checked }))} /><span>{label}</span></label>)}</div><p className="pc-muted pc-small">Screenshot coverage counts attachments. Chart images are not visually analyzed.</p>{!sourceCount && <p className="pc-error-text">Choose at least one source.</p>}</div><div><Label htmlFor="coach-focus">Anything to focus on? <span className="pc-muted">Optional</span></Label><Textarea id="coach-focus" value={instructions} maxLength={1500} onChange={e => setInstructions(e.target.value)} placeholder="Focus on FOMO, off-session entries, and whether I'm forcing trades around H1 levels." /><p className="pc-muted pc-small">The coach will investigate this against your records. {instructions.length}/1,500</p></div></div></details>
      <div className="pc-builder-footer"><span><ShieldCheck size={13} />Evidence first. Clear next steps.</span><span>{dataQuery.isPending ? "Loading your journal…" : analysis ? `${analysis.tradeCount} trades · ${analysis.journalCount} journal notes · ${analysis.checklistCount} checklists` : "Select a valid review window"}</span></div>
    </fieldset></section>

    {dataQuery.isError && <div className="pc-notice pc-error" role="alert"><p>Couldn't load your trading records. Your past reviews are still available.</p><Button variant="outline" onClick={() => dataQuery.refetch()}>Retry loading data</Button></div>}
    {analysis?.limitations.some(l => l.includes("could not be loaded")) && <div className="pc-notice"><p>Some sources are unavailable: {analysis.limitations.filter(l => l.includes("could not be loaded")).join(" ")}</p><Button variant="ghost" onClick={() => dataQuery.refetch()}>Retry sources</Button></div>}
    {providerQuery.isError && <div className="pc-notice pc-error" role="alert"><p>{providerQuery.error instanceof Error ? providerQuery.error.message : "The coach provider is unavailable."}</p><Button variant="outline" onClick={() => providerQuery.refetch()}>Check again</Button></div>}
    {!providerQuery.data?.ready && !report && !dataQuery.isPending && <div className="pc-connect-notice"><Plug size={17} /><p>The coach needs a working server connection to generate reviews.</p><Button variant="ghost" onClick={() => setConnectionOpen(true)}>Check connection <ArrowRight size={14} /></Button></div>}
    {generating && <div className="pc-generating" role="status"><div className="pc-loading-icon"><Loader2 size={24} className="animate-spin" /></div><div><h2>Your performance review is taking shape</h2><p>{stage}</p><span>Large journals may take a couple of minutes. Your previous review stays available.</span></div><Button variant="ghost" onClick={cancel}><X size={15} />Cancel</Button></div>}
    {error && <div className="pc-notice pc-error" role="alert"><div><strong>Review couldn't be completed</strong><p>{error}</p></div>{retryable && <Button variant="outline" onClick={generate} disabled={generating}>Try again <RefreshCw size={14} /></Button>}</div>}
    {storageWarning && <p className="pc-notice" role="status">{storageWarning}</p>}

    <div ref={reportTop} tabIndex={-1} className="pc-report-anchor">
      {report ? <><div className="pc-review-toolbar"><p>Viewing your {report.analysis.window.period.toLowerCase()} review. The controls above apply to your next report.</p><div><Button variant="ghost" onClick={copyReport}><Copy size={14} />Copy</Button><Button variant="outline" onClick={downloadReport}><Download size={14} />Download</Button></div></div><CoachReview saved={report} /></> : !generating && <>
        <section className="pc-welcome"><div className="pc-welcome-main"><span className="pc-kicker">A CLEARER VIEW OF YOUR TRADING</span><h2>Your journal has a story.<br /><span>Find the part that matters.</span></h2><p>A focused review of what works, what repeats, and what to change next—grounded in the trades and reflections you've recorded.</p><div className="pc-welcome-points"><span><Check size={14} />Evidence behind each finding</span><span><Check size={14} />A practical plan for your next session</span></div></div><div className="pc-review-outline"><div><span>01</span><div><h3>See the real issue</h3><p>Separate strategy, execution, risk, and behavior.</p></div><FileSearch size={19} /></div><div><span>02</span><div><h3>Understand the pattern</h3><p>Connect outcomes to your notes and decisions.</p></div><BarChart3 size={19} /></div><div><span>03</span><div><h3>Know your next move</h3><p>Leave with a short, measurable coaching plan.</p></div><Target size={19} /></div></div></section>
        {analysis && analysis.tradeCount > 0 ? <><div className="pc-readiness"><BookOpen size={18} /><div><h3>Your review starts with {analysis.tradeCount} trades</h3><p>{analysis.journalCount} journal notes and {analysis.checklistCount} checklists add context. Missing information will be called out explicitly.</p></div><span className="pc-badge">{analysis.tradeCount < 20 ? "Early evidence" : "Ready to review"}</span></div><ProcessMeasures analysis={analysis} /></> : !dataQuery.isPending && !dataQuery.isError && range.value && <div className="pc-empty-data"><BookOpen size={24} /><h3>No trades in this window</h3><p>Choose a wider period, or record a trade and add the decisions behind it.</p><div><Button variant="outline" onClick={() => setPeriod("All Time")}>Review all history</Button><Button asChild><Link to="/trades">Go to trades <ArrowRight size={14} /></Link></Button></div></div>}
      </>}
    </div>
    <footer className="pc-footer"><span>DaddyFXBook <i>·</i> Reflect. Adjust. Repeat.</span><button onClick={() => setLegacyOpen(true)}>Previous scorecards <ArrowRight size={12} /></button></footer>

    <Dialog open={connectionOpen} onOpenChange={setConnectionOpen}><DialogContent className="pc-dialog"><DialogHeader><DialogTitle>Performance Coach connection</DialogTitle><DialogDescription>OpenRouter is managed securely on the server. Selected journal data is sent only when you generate a review.</DialogDescription></DialogHeader><div className="pc-connection-form"><p role="status">{providerQuery.isPending ? "Checking the coach connection…" : providerQuery.data?.ready ? "Coach connection is ready." : providerQuery.error instanceof Error ? providerQuery.error.message : "The coach connection is unavailable."}</p><div className="pc-dialog-actions"><Button type="button" variant="outline" disabled={providerQuery.isFetching} onClick={() => providerQuery.refetch()}>{providerQuery.isFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}Check again</Button></div></div></DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="pc-dialog"><DialogHeader><DialogTitle>Past performance reviews</DialogTitle><DialogDescription>Your five most recent reviews, saved for this account on this browser. Download reviews to keep a separate copy.</DialogDescription></DialogHeader><div className="pc-history-list">{savedReviews.length ? savedReviews.map(saved => <button key={saved.id} onClick={() => { setReport(saved); setHistoryOpen(false); setStorageWarning(""); }}><div><span>{saved.analysis.window.period} · {new Date(saved.generatedAt).toLocaleDateString()}</span><strong>{saved.report.verdict.headline}</strong><small>{saved.analysis.tradeCount} trades · {saved.analysis.window.label}</small></div><ArrowRight size={16} /></button>) : <p className="pc-muted">Your first completed review will appear here.</p>}</div></DialogContent></Dialog>
    <Dialog open={legacyOpen} onOpenChange={setLegacyOpen}><DialogContent className="pc-legacy-dialog"><DialogHeader><DialogTitle>Previous scorecards</DialogTitle><DialogDescription>Existing saved scores use the original scoring rules. They are kept separately from the new report's transparent process measures.</DialogDescription></DialogHeader>{legacyOpen && <Suspense fallback={<p>Loading saved scorecards…</p>}><LegacyScorecards /></Suspense>}</DialogContent></Dialog>
  </div>;
}
