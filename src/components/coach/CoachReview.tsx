import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ClipboardCheck, FileSearch, Minus, Target } from "lucide-react";
import type { CoachAnalysis, Dimension } from "@/lib/coach/types";
import { DIMENSIONS } from "@/lib/coach/types";
import type { SavedCoachReport, CoachReport } from "@/lib/coach/report";

export function EvidenceList({ ids, analysis }: { ids: string[]; analysis: CoachAnalysis }) {
  const items = ids.map(id => analysis.evidence.find(e => e.id === id)).filter(Boolean);
  if (!items.length) return <p className="pc-muted pc-small">Insufficient recorded evidence.</p>;
  return <details className="pc-evidence"><summary><FileSearch size={14} />View evidence <span>{items.length}</span><ChevronDown size={14} /></summary><div className="pc-evidence-body">{items.map(e => e && <div className="pc-observation" key={e.id}><span className="pc-kicker">DATA OBSERVATION · {e.id}</span><h4>{e.title}</h4><p>{e.observation}</p>{e.tradeIds.length > 0 && <details className="pc-records"><summary>Inspect {e.tradeIds.length} example{e.tradeIds.length === 1 ? "" : "s"}{e.totalRecords > e.tradeIds.length ? ` of ${e.totalRecords} records` : ""}</summary><ul>{e.tradeIds.map(id => { const t = analysis.records.find(t => t.id === id); return <li key={id}><span>{t?.symbol || "Journal-linked trade"} · {t ? new Date(t.date).toLocaleString() : "Recorded trade"}{t?.pnl != null && ` · P&L ${Number(t.pnl).toLocaleString()}`}</span><code>{id}</code></li>; })}</ul></details>}</div>)}</div></details>;
}

export function ProcessMeasures({ analysis }: { analysis: CoachAnalysis }) {
  return <section className="pc-card pc-measures" id="coach-scorecard">
    <div className="pc-section-heading"><div><span className="pc-kicker">MEASURE THE PROCESS</span><h2>Your process scorecard</h2></div><span className="pc-badge">Calculated from records</span></div>
    <p className="pc-muted pc-small">Five transparent measures, not an overall grade. These are limited data proxies; the coach's interpretation is shown separately.</p>
    <div className="pc-measure-list">{analysis.measures.map(m => <details key={m.dimension} className="pc-measure"><summary><div><strong>{DIMENSIONS[m.dimension]}</strong><span>{m.label}</span></div><div className="pc-measure-meter"><span style={{ width: `${m.score || 0}%` }} /></div><b>{m.score === null ? "—" : Math.round(m.score)}<small>{m.score === null ? "Not enough data" : "/ 100"}</small></b><ChevronDown size={15} /></summary><div className="pc-measure-detail"><p>{m.detail}</p><p><strong>How it's calculated:</strong> {m.formula}</p><p className="pc-muted">{m.limitation}</p><EvidenceList ids={m.evidenceIds} analysis={analysis} /></div></details>)}</div>
  </section>;
}

export function ChangeOverTime({ analysis }: { analysis: CoachAnalysis }) {
  return <section className="pc-card pc-change"><div className="pc-section-heading"><div><span className="pc-kicker">THE DIRECTION OF TRAVEL</span><h2>Change over time</h2></div></div><p className="pc-muted pc-small">{analysis.comparisonNote}</p>
    {analysis.comparisons.length ? <div className="pc-change-grid">{analysis.comparisons.map(c => { const Icon = c.direction === "neutral" ? Minus : c.direction === "up" ? ArrowUpRight : ArrowDownRight; return <div key={c.label}><span>{c.label}</span><strong>{c.current.toFixed(1)}% <small className={`pc-trend-${c.direction}`}><Icon size={15} />{c.current - c.previous > 0 ? "+" : ""}{(c.current - c.previous).toFixed(1)} pp</small></strong><p>Previously {c.previous.toFixed(1)}%</p><EvidenceList ids={[c.evidenceId]} analysis={analysis} /></div>; })}</div> : <p className="pc-comparison-empty">A comparison will appear when both periods have enough relevant records.</p>}
  </section>;
}

function InsightCard({ insight, analysis, index }: { insight: CoachReport["insights"][number]; analysis: CoachAnalysis; index: number }) {
  return <article className={`pc-insight pc-priority-${insight.priority.toLowerCase().replace(/ /g, "-")}`}>
    <div className="pc-insight-top"><span className="pc-insight-number">{String(index + 1).padStart(2, "0")}</span><span className="pc-priority">{insight.priority}</span><span className="pc-muted pc-small">{DIMENSIONS[insight.dimension]}</span></div>
    <h3>{insight.title}</h3><span className="pc-kicker pc-interpretation-label">COACH INTERPRETATION</span><p>{insight.interpretation}</p>
    <EvidenceList ids={insight.evidenceIds} analysis={analysis} />
    {insight.rootCause && <details className="pc-root-cause"><summary>What might be driving this? <ChevronDown size={14} /></summary><p><strong>Hypothesis:</strong> {insight.rootCause.hypothesis}</p><p><strong>Alternative:</strong> {insight.rootCause.alternative}</p><p><strong>Test it:</strong> {insight.rootCause.test}</p></details>}
    <div className="pc-action"><ArrowRight size={16} /><div><span className="pc-kicker">{insight.priority === "Doing well" ? "KEEP DOING THIS" : "YOUR NEXT MOVE"}</span><p>{insight.action}</p><span className="pc-action-measure"><ClipboardCheck size={13} />{insight.measurement}</span></div></div>
  </article>;
}

export function CoachReview({ saved }: { saved: SavedCoachReport }) {
  const { report, analysis } = saved;
  const priorities = report.insights.filter(i => i.priority !== "Doing well");
  const strengths = report.insights.filter(i => i.priority === "Doing well");
  const supported = report.dimensions.filter(d => d.confidence === "Supported").length;
  const mostImportant = priorities[0];
  return <div className="pc-review">
    <div className="pc-report-meta"><span><span className="pc-live-dot" />PERFORMANCE REVIEW</span><span>{new Date(saved.generatedAt).toLocaleString()} · {analysis.tradeCount} trades</span></div>
    <section className="pc-verdict" id="coach-overview">
      <div className="pc-verdict-copy"><span className="pc-badge pc-blue-badge">{report.verdict.condition}</span><h2>{report.verdict.headline}</h2><p>{report.verdict.summary}</p><EvidenceList ids={report.verdict.evidenceIds} analysis={analysis} /></div>
      <div className="pc-verdict-scan"><div><span className="pc-kicker">BUILD ON</span><strong>{strengths[0]?.title || "No clear strength established yet"}</strong></div><div><span className="pc-kicker">FOCUS FIRST</span><strong>{mostImportant?.title || "Keep the process consistent"}</strong></div><div><span className="pc-kicker">NEXT SESSION</span><strong>{report.nextPlan.focus}</strong></div></div>
    </section>
    <div className="pc-snapshot-caption">{analysis.window.label} <span>· {analysis.window.timezone} · grouped by entry time</span></div>
    <nav className="pc-report-nav" aria-label="Review sections"><a href="#coach-priorities">Priorities</a><a href="#coach-deep-review">Deep review</a><a href="#coach-scorecard">Scorecard</a><a href="#coach-next-session">Next session <ArrowRight size={13} /></a></nav>
    <section id="coach-priorities"><div className="pc-section-heading"><div><span className="pc-kicker">LESS TO FIX. MORE TO FOCUS ON.</span><h2>What deserves your attention</h2></div><span className="pc-muted pc-small">Ranked by impact</span></div>
      {priorities.length ? <div className="pc-insight-grid">{priorities.map((insight, index) => <InsightCard key={insight.id} insight={insight} analysis={analysis} index={index} />)}</div> : <div className="pc-card pc-empty-priorities">No material leak was supported by the available evidence. Keep collecting context before drawing broader conclusions.</div>}
    </section>
    {strengths.length > 0 && <section className="pc-strengths"><div className="pc-section-heading"><div><span className="pc-kicker">PROTECT WHAT'S WORKING</span><h2>Strengths to carry forward</h2></div><Check size={20} /></div><div className="pc-insight-grid">{strengths.map((insight, index) => <InsightCard key={insight.id} insight={insight} analysis={analysis} index={index} />)}</div></section>}
    <section className="pc-card" id="coach-deep-review"><div className="pc-section-heading"><div><span className="pc-kicker">LOOK BELOW THE SURFACE</span><h2>The full coaching review</h2></div><span className="pc-muted pc-small">{supported}/5 areas with supporting evidence</span></div><div className="pc-dimensions">{report.dimensions.map(d => <details key={d.dimension}><summary><strong>{DIMENSIONS[d.dimension as Dimension]}</strong><span className={`pc-confidence pc-confidence-${d.confidence === "Supported" ? "supported" : "limited"}`}>{d.confidence}</span><ChevronDown size={15} /></summary><div><span className="pc-kicker">COACH INTERPRETATION</span><p>{d.assessment}</p><EvidenceList ids={d.evidenceIds} analysis={analysis} /></div></details>)}</div></section>
    <ProcessMeasures analysis={analysis} />
    <ChangeOverTime analysis={analysis} />
    <section className="pc-next-plan" id="coach-next-session"><div className="pc-next-heading"><div className="pc-next-icon"><Target size={24} /></div><div><span className="pc-kicker">TAKE THIS INTO YOUR NEXT SESSION</span><h2>{report.nextPlan.focus}</h2></div></div><div className="pc-plan-items">{report.nextPlan.items.map((item, index) => <div key={`${item.label}-${index}`}><span className="pc-plan-index">{String(index + 1).padStart(2, "0")}</span><div><span className="pc-kicker">{item.label.toUpperCase()}</span><p>{item.instruction}</p><EvidenceList ids={item.evidenceIds} analysis={analysis} /></div></div>)}</div><p className="pc-plan-footer">Review this plan before trading. Record what you followed, what changed, and why.</p></section>
    <details className="pc-methodology"><summary>Report scope & limitations <ChevronDown size={14} /></summary><div><p>{analysis.tradeCount} trades in aggregate; {analysis.sampleCount} detailed trade records sampled. Included: {Object.entries(analysis.include).filter(([, on]) => on).map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}.</p><ul>{[...new Set([...analysis.limitations, ...report.limitations])].map(item => <li key={item}>{item}</li>)}</ul>{saved.instructions && <p><strong>Your focus:</strong> {saved.instructions}</p>}</div></details>
  </div>;
}

