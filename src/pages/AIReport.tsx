import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Key, Eye, EyeOff, Save, CheckCircle2,
  Download, Copy, RefreshCw, Target, BrainCircuit,
  TrendingUp, TrendingDown, Clock, ChevronDown, Check,
  Zap, Shield, Brain, BarChart2, Activity, FileText,
  ServerCrash, AlertCircle, Info,
} from "lucide-react";
import { subDays, format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchExportData } from "@/hooks/useTrades";
import { buildScorecard } from "@/lib/scoring";
import {
  OPENROUTER_MODELS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  validateOpenRouterKey,
  generateWithFallback,
  buildPrompt,
  AI_SYSTEM_INSTRUCTION,
  formatAIReport,
  reportToPlainText,
} from "@/lib/ai";
import type { OpenRouterModelId, FormattedReport, ReportSection } from "@/lib/ai";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ReportPeriod = "Daily" | "Weekly" | "Monthly" | "Custom" | "Full (All Time)";
type KeyStatus = "idle" | "checking" | "valid" | "invalid";

interface DataToggles {
  trades: boolean;
  journalEntries: boolean;
  strategySetup: boolean;
  emotions: boolean;
  tags: boolean;
  lessonsLearned: boolean;
  screenshots: boolean;
  executionChecklist: boolean;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Connecting to OpenRouter...",
  "Verifying API key...",
  "Fetching your trades...",
  "Fetching journal entries...",
  "Fetching checklists & screenshots...",
  "Computing performance metrics...",
  "Analysing session performance...",
  "Detecting behavioural patterns...",
  "Building coaching prompt...",
  "Sending to AI model...",
  "AI is analysing your trading psychology...",
  "AI is identifying hidden patterns...",
  "AI is writing your action plan...",
  "Finalising report...",
];

const TOGGLE_LABELS: Record<keyof DataToggles, string> = {
  trades: "Trades",
  journalEntries: "Journal Entries",
  strategySetup: "Strategy Setup",
  emotions: "Emotions",
  tags: "Tags",
  lessonsLearned: "Lessons Learned",
  screenshots: "Screenshots",
  executionChecklist: "Checklist",
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const colour = score >= 70 ? "bg-blue-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const text = score >= 70 ? "text-blue-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          {icon} {label}
        </span>
        <span className={`text-sm font-black ${text}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${colour}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: ReportSection }) {
  const [open, setOpen] = useState(false);
  const border = { default: "border-white/[0.05]", success: "border-emerald-500/20", warning: "border-amber-500/20", danger: "border-red-500/20" }[section.tone];
  const dot = { default: "bg-blue-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" }[section.tone];
  return (
    <div className={`bg-[#121212] border ${border} rounded-2xl overflow-hidden`}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-bold text-white flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-zinc-600 text-[11px] font-black tabular-nums">{section.number}.</span>
          {section.title}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-zinc-600 transition-transform duration-200 shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-5 border-t border-white/[0.04]">
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium pt-4">{section.body}</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function AIReportPage() {
  const { user } = useAuth();

  // Config
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [selectedModel, setSelectedModel] = useState<OpenRouterModelId>(DEFAULT_MODEL);
  const [period, setPeriod] = useState<ReportPeriod>("Weekly");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [instructions, setInstructions] = useState("");
  const [toggles, setToggles] = useState<DataToggles>({
    trades: true,
    journalEntries: true,
    strategySetup: true,
    emotions: true,
    tags: true,
    lessonsLearned: true,
    screenshots: false,
    executionChecklist: true,
  });

  // Report
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<FormattedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptedModels, setAttemptedModels] = useState<string[]>([]);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore persisted settings
  useEffect(() => {
    const k = localStorage.getItem("openrouter_api_key");
    if (k) { setApiKey(k); setKeyStatus("valid"); }
    const m = localStorage.getItem("openrouter_model") as OpenRouterModelId;
    if (m && OPENROUTER_MODELS[m]) setSelectedModel(m);
    const ins = localStorage.getItem("ai_report_instructions");
    if (ins) setInstructions(ins);
  }, []);

  // Loading animation helpers
  const startLoading = useCallback(() => {
    let step = 0;
    setLoadingStep(LOADING_STEPS[0]);
    setProgress(2);
    stepTimer.current = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1);
      setLoadingStep(LOADING_STEPS[step]);
      setProgress(2 + (step / (LOADING_STEPS.length - 1)) * 88);
    }, 2000);
  }, []);

  const stopLoading = useCallback(() => {
    if (stepTimer.current) clearInterval(stepTimer.current);
    setProgress(100);
  }, []);

  // Key verification
  const handleSaveKey = async () => {
    if (!apiKey.trim()) { toast.error("Please enter your OpenRouter API key."); return; }
    setKeyStatus("checking");
    const { valid, error: keyErr } = await validateOpenRouterKey(apiKey.trim());
    if (valid) {
      localStorage.setItem("openrouter_api_key", apiKey.trim());
      setKeyStatus("valid");
      toast.success("API key verified and saved.");
    } else {
      setKeyStatus("invalid");
      toast.error(keyErr ?? "Invalid API key.");
    }
  };

  // Model change
  const handleModelChange = (model: OpenRouterModelId) => {
    setSelectedModel(model);
    localStorage.setItem("openrouter_model", model);
  };

  // Copy & download
  const handleCopy = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(report.rawMarkdown);
    toast.success("Report copied to clipboard.");
  }, [report]);

  const handleDownload = useCallback(() => {
    if (!report) return;
    const blob = new Blob([reportToPlainText(report)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DaddyFxBook_AI_Report_${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded as TXT.");
  }, [report]);

  // Main generation
  const generateReport = useCallback(async () => {
    if (keyStatus !== "valid") { toast.error("Please save and verify your OpenRouter API key first."); return; }
    if (!user) { toast.error("You must be logged in to generate a report."); return; }
    if (period === "Custom" && (!customRange.from || !customRange.to)) {
      toast.error("Select both start and end dates for a custom report.");
      return;
    }

    setGenerating(true);
    setReport(null);
    setError(null);
    setAttemptedModels([]);
    startLoading();

    try {
      // 1 — Resolve date window
      const now = new Date();
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (period === "Daily") {
        const s = new Date(now); s.setHours(0, 0, 0, 0); startDate = s.toISOString();
      } else if (period === "Weekly") {
        startDate = subDays(now, 7).toISOString();
      } else if (period === "Monthly") {
        startDate = subDays(now, 30).toISOString();
      } else if (period === "Custom") {
        startDate = customRange.from!.toISOString();
        endDate = customRange.to!.toISOString();
      }
      // "Full (All Time)" → undefined → no filter

      // 2 — Fetch data
      const data = await fetchExportData(user.id, startDate, endDate);
      if (data.trades.length === 0) {
        throw new Error("No trades found in the selected period. Try a wider date range.");
      }

      // 3 — Scorecard (deterministic, client-side)
      const scorecard = buildScorecard(data.trades, data.journals, data.checklists, []);

      // 4 — Prompt
      if (instructions) localStorage.setItem("ai_report_instructions", instructions);

      const prompt = buildPrompt({
        trades: data.trades,
        journals: data.journals,
        checklists: data.checklists,
        screenshots: data.screenshots,
        scorecard,
        reportType: period === "Full (All Time)" ? "Full" : period,
        include: toggles,
        customInstructions: instructions || undefined,
      });

      // 5 — Generate with automatic model fallback
      const result = await generateWithFallback({
        apiKey,
        preferredModel: selectedModel,
        prompt,
        systemInstruction: AI_SYSTEM_INSTRUCTION,
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
        onModelAttempt: (model, n) => {
          setLoadingStep(`Sending to ${OPENROUTER_MODELS[model as OpenRouterModelId]?.label ?? model}...`);
          setAttemptedModels((prev) => [...new Set([...prev, model])]);
          if (n > 1) toast.info(`Trying ${OPENROUTER_MODELS[model as OpenRouterModelId]?.label ?? model}...`);
        },
        onModelFailed: (model, err, willRetry) => {
          const label = OPENROUTER_MODELS[model as OpenRouterModelId]?.label ?? model;
          if (willRetry) toast.error(`${label}: ${err} — trying next model...`);
        },
      });

      stopLoading();

      if (!result.success || !result.report) {
        throw new Error(result.error ?? "AI returned no content. Please try again.");
      }

      // 6 — Format
      const formatted = formatAIReport(result.report, scorecard, {
        provider: result.provider,
        model: result.model,
        generatedAt: result.timestamp,
        latencyMs: result.latencyMs,
        tradeCount: data.trades.length,
        wasCapped: data.trades.length > 200,
      });

      setReport(formatted);
      const secs = ((result.latencyMs ?? 0) / 1000).toFixed(1);
      const label = OPENROUTER_MODELS[result.model as OpenRouterModelId]?.label ?? result.model;
      toast.success(`Report generated in ${secs}s using ${label}.`);
    } catch (err: unknown) {
      stopLoading();
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
      setLoadingStep("");
    }
  }, [apiKey, keyStatus, user, period, customRange, toggles, instructions, selectedModel, startLoading, stopLoading]);

  // ── Derived ───────────────────────────────────────────────────
  const canGenerate = keyStatus === "valid" && !generating;

  const keyBadge = {
    idle: null,
    checking: <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold"><RefreshCw className="w-3 h-3 animate-spin" />Checking...</span>,
    valid: <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold"><CheckCircle2 className="w-3 h-3" />Connected</span>,
    invalid: <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold"><AlertCircle className="w-3 h-3" />Invalid</span>,
  }[keyStatus];

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="overflow-guard space-y-4 md:space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <span className="truncate">AI Report</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium sm:ml-[52px]">
            Elite coaching powered by OpenRouter — Claude, GPT-4o, Gemini, and more.
          </p>
        </div>

        {report && (
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 flex-wrap w-full sm:w-auto">
            <button onClick={generateReport} disabled={generating}
              className="px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-white/5 border border-white/[0.08] text-xs font-bold text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-40">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-white/5 border border-white/[0.08] text-xs font-bold text-zinc-300 transition-colors flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-white/5 border border-white/[0.08] text-xs font-bold text-zinc-300 transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download TXT
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* ════ LEFT — Configuration ════ */}
        <div className="xl:col-span-4">
          <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-6 space-y-5">

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <BrainCircuit className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AI Configuration</h2>
                <p className="text-[11px] text-zinc-500 font-medium">Keys are stored locally. Never sent to our servers.</p>
              </div>
            </div>

            {/* OpenRouter info pill */}
            <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                Get a free API key at{" "}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 underline underline-offset-2 hover:text-blue-300">
                  openrouter.ai/keys
                </a>. Access Claude, GPT-4o, Gemini and more through one key.
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                OpenRouter API Key {keyBadge}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyStatus("idle"); }}
                  placeholder="sk-or-..."
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
                <button type="button" onClick={() => setShowKey((s) => !s)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-white transition-colors">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={handleSaveKey} disabled={keyStatus === "checking" || !apiKey.trim()}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/[0.08] flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                {keyStatus === "checking"
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Verifying...</>
                  : <><Save className="w-3.5 h-3.5" />Save & Verify</>}
              </button>
            </div>

            <hr className="border-white/[0.05]" />

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Model</label>
              <div className="space-y-1.5">
                {(Object.values(OPENROUTER_MODELS)).map((m) => (
                  <button key={m.id} onClick={() => handleModelChange(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all",
                      selectedModel === m.id
                        ? "bg-blue-500/10 border-blue-500/40"
                        : "bg-[#121212] border-white/[0.06] hover:bg-white/[0.02]"
                    )}>
                    <div>
                      <p className="text-xs font-bold text-white">{m.label}</p>
                      <p className="text-[10px] text-zinc-500">{m.description}</p>
                    </div>
                    {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-white/[0.05]" />

            {/* Report Period */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Report Period</label>
              <div className="flex flex-wrap gap-2">
                {(["Daily", "Weekly", "Monthly", "Custom", "Full (All Time)"] as ReportPeriod[]).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                      period === p
                        ? "bg-blue-600 text-white border-blue-500"
                        : "bg-[#121212] text-zinc-400 border-white/[0.08] hover:text-white"
                    )}>
                    {p}
                  </button>
                ))}
              </div>

              {period === "Custom" && (
                <div className="flex gap-3 pt-1 animate-in fade-in">
                  {(["from", "to"] as const).map((key) => (
                    <div key={key} className="flex-1">
                      <p className="text-[10px] text-zinc-500 font-semibold mb-1">{key === "from" ? "Start" : "End"}</p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1.5 w-full px-2.5 py-2 rounded-lg bg-[#121212] border border-white/[0.06] text-xs text-white hover:bg-white/[0.02] transition-colors">
                            <CalendarIcon className="w-3 h-3 text-zinc-500" />
                            {customRange[key] ? format(customRange[key]!, "MMM d, yy") : <span className="text-zinc-600">Pick</span>}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-white/[0.06] bg-[#0B0B0B]" align="start">
                          <Calendar mode="single" selected={customRange[key]} initialFocus
                            onSelect={(d) => setCustomRange((prev) => ({ ...prev, [key]: d }))}
                            disabled={key === "to" && customRange.from ? (d) => d < customRange.from! : undefined} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Include Data */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Include Data</label>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-y-2.5 gap-x-4">
                {(Object.keys(toggles) as (keyof DataToggles)[]).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => setToggles((p) => ({ ...p, [key]: !p[key] }))}>
                    <div className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                      toggles[key] ? "bg-blue-600 border-blue-500" : "bg-[#121212] border-white/[0.15]"
                    )}>
                      {toggles[key] && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className={cn("text-[11px] font-semibold transition-colors",
                      toggles[key] ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")}>
                      {TOGGLE_LABELS[key]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Custom Instructions</label>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Focus on FOMO during London open, revenge trades after losses..."
                className="w-full h-20 bg-[#121212] border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none" />
            </div>

            {/* Generate */}
            <button onClick={generateReport} disabled={!canGenerate}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300",
                canGenerate
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}>
              {generating
                ? <><RefreshCw className="w-5 h-5 animate-spin" /><span className="truncate max-w-[200px]">{loadingStep}</span></>
                : <><Sparkles className="w-5 h-5" />Generate AI Report</>}
            </button>

            {generating && (
              <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            )}

          </div>
        </div>

        {/* ════ RIGHT — Report Output ════ */}
        <div className="xl:col-span-8 space-y-4">

          {/* Empty state */}
          {!generating && !report && !error && (
            <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-8 sm:p-16 flex flex-col items-center justify-center text-center min-h-[320px] sm:min-h-[480px]">
              <div className="w-20 h-20 rounded-3xl bg-blue-500/5 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                <Sparkles className="w-10 h-10 text-blue-500 relative z-10" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No report generated yet</h3>
              <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
                Add your OpenRouter key, choose a model and period, then generate. Your AI trading coach will review 35 performance sections using all your data.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["35 Analysis Sections", "Psychology Review", "Behavioral Detection", "Risk Analysis", "Action Plan", "Coach Message"].map((tag) => (
                  <span key={tag} className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !generating && (
            <div className="bg-[#0B0B0B] border border-red-500/20 rounded-[24px] p-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <ServerCrash className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white mb-1">Generation Failed</p>
                  <p className="text-sm text-red-400">{error}</p>
                  {attemptedModels.length > 0 && (
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Tried: {attemptedModels.map((m) => OPENROUTER_MODELS[m as OpenRouterModelId]?.label ?? m).join(" → ")}
                    </p>
                  )}
                  <button onClick={generateReport}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {generating && (
            <div className="space-y-3">
              <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-sm font-bold text-blue-400 tracking-wide">{loadingStep}</span>
                </div>
                <p className="text-xs text-zinc-600">Analysing your complete trading history with AI...</p>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-14 bg-[#0B0B0B] border border-white/[0.04] rounded-2xl animate-pulse`}
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          )}

          {/* ══ Report ══ */}
          {report && !generating && (
            <div className="space-y-4 animate-in fade-in duration-500 report-content">

              {/* Meta banner */}
              <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[20px] px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-zinc-400">
                    {format(new Date(report.meta.generatedAt), "MMM d, yyyy 'at' HH:mm")}
                    {" · "}{OPENROUTER_MODELS[report.meta.model as OpenRouterModelId]?.label ?? report.meta.model}
                    {report.meta.latencyMs ? ` · ${(report.meta.latencyMs / 1000).toFixed(1)}s` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {report.meta.wasCapped && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">Capped 200</span>
                  )}
                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{period}</span>
                </div>
              </div>

              {/* Scorecard */}
              <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-6">
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" /> Performance Scorecard
                  </h2>
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_25px_rgba(37,99,235,0.4)]">
                      <span className="text-2xl font-black text-white">{report.scores.grade}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold mt-1.5 uppercase tracking-wider">{report.scores.classification}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <ScoreBar label="Discipline" score={report.scores.discipline} icon={<Shield className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Risk Mgmt" score={report.scores.risk} icon={<BarChart2 className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Execution" score={report.scores.execution} icon={<Zap className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Psychology" score={report.scores.psychology} icon={<Brain className="w-3.5 h-3.5" />} />
                  <ScoreBar label="Consistency" score={report.scores.consistency} icon={<Activity className="w-3.5 h-3.5" />} />
                </div>
              </div>

              {/* Executive Summary */}
              {report.executiveSummary && (
                <div className="bg-gradient-to-br from-blue-600/10 to-[#0B0B0B] border border-blue-500/20 rounded-[24px] p-6">
                  <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Executive Summary
                  </h3>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{report.executiveSummary}</p>
                </div>
              )}

              {/* Strengths / Weaknesses */}
              {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.strengths.length > 0 && (
                    <div className="bg-[#121212] border border-emerald-500/20 rounded-2xl p-5">
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Strengths
                      </h3>
                      <ul className="space-y-2">
                        {report.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.weaknesses.length > 0 && (
                    <div className="bg-[#121212] border border-red-500/20 rounded-2xl p-5">
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" /> Weaknesses
                      </h3>
                      <ul className="space-y-2">
                        {report.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Plan */}
              {report.actionPlan.length > 0 && (
                <div className="bg-[#121212] border border-blue-500/20 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" /> Action Plan
                  </h3>
                  <div className="space-y-3">
                    {report.actionPlan.map((a, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-blue-500 font-black shrink-0">{i + 1}.</span>
                        <span className="text-zinc-300">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Goals + Daily Focus */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.weeklyGoals.length > 0 && (
                  <div className="bg-[#121212] border border-amber-500/20 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" /> Weekly Goals
                    </h3>
                    {report.weeklyGoals.map((g, i) => (
                      <div key={i} className="flex gap-3 text-sm mb-2">
                        <span className="text-amber-500 font-black shrink-0">→</span>
                        <span className="text-zinc-300">{g}</span>
                      </div>
                    ))}
                  </div>
                )}
                {report.dailyFocus && (
                  <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Daily Focus</p>
                      <p className="text-sm font-bold text-white leading-snug">{report.dailyFocus}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 35 Collapsible Sections */}
              {report.sections.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-1">
                    Full Analysis — {report.sections.length} Sections
                  </p>
                  {report.sections.map((s) => <SectionCard key={s.number} section={s} />)}
                </div>
              )}

              {/* Coach Message */}
              {report.coachMessage && (
                <div className="bg-gradient-to-br from-blue-600/10 to-[#0B0B0B] border border-blue-500/30 rounded-[24px] p-6 relative overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-36 h-36 bg-blue-500/5 blur-3xl rounded-full" />
                  <div className="flex gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-400 mb-2">Final Coach Message</p>
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{report.coachMessage}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
