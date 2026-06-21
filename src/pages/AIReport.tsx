import { useState, useEffect } from "react";
import { 
  Sparkles, Key, Eye, EyeOff, Save, CheckCircle2, 
  Download, Copy, RefreshCw, FileText, Target,
  BrainCircuit, TrendingUp, TrendingDown, Clock, MessageSquare, AlertCircle
} from "lucide-react";

type ReportType = 'Daily Review' | 'Weekly Review' | 'Monthly Review' | 'Custom';

export default function AIReportPage() {
  // Config State
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [reportType, setReportType] = useState<ReportType>('Weekly Review');
  
  const [dataToggles, setDataToggles] = useState({
    trades: true,
    journalEntries: true,
    strategySetup: false,
    emotions: true,
    tags: true,
    lessonsLearned: false,
    screenshots: false,
    executionChecklist: false,
  });

  // Report State
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);

  // Load key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setKeySaved(true);
    }
  }, []);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setKeySaved(true);
      // Small timeout to revert the success state visually if needed, 
      // but keeping it 'connected' is better.
    }
  };

  const handleToggle = (key: keyof typeof dataToggles) => {
    setDataToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const generateReport = () => {
    if (!keySaved) {
      alert("Please save your Gemini API key first.");
      return;
    }
    
    setIsGenerating(true);
    setReport(null);
    
    // Simulate API call and generation time
    setTimeout(() => {
      setReport({
        grade: "B+",
        scores: {
          consistency: 85,
          discipline: 90,
          risk: 75,
          psychology: 80
        },
        strengths: [
          "Excellent Risk:Reward discipline maintained throughout the week.",
          "Good session selection, avoiding low-probability setups during Asian hours.",
          "Strong execution on breakout strategies."
        ],
        weaknesses: [
          "Entering trades too early before full confirmation.",
          "Tendency to revenge trade immediately after a stop loss is hit.",
          "Inconsistent stop placement on volatile pairs (e.g., XAUUSD)."
        ],
        patterns: {
          bestSession: "New York",
          bestSetup: "Trend Continuation",
          worstSetup: "Mean Reversion",
          avgRR: "1:2.4",
          commonEmotion: "FOMO",
          mostRepeatedMistake: "Moving Stop Loss to Breakeven too early"
        },
        psychology: "Your emotional discipline is improving, but fear of missing out (FOMO) is still dictating some entries. When you miss a setup, you tend to force the next one. Patience is your biggest area for growth right now.",
        actionPlan: [
          "Wait for 15m candle close before executing any breakout entry.",
          "Implement a mandatory 15-minute screen break after any losing trade.",
          "Set hard daily loss limit at 2% and walk away automatically.",
          "Journal emotions before clicking buy/sell, not just after.",
          "Review all XAUUSD setups for the past month to refine stop placements."
        ],
        coachNotes: "You had a solid week overall. The B+ grade reflects great discipline but highlights the need to curb those early entries. Remember, cash is a position too. Focus heavily on Action Item #1 next week. You're doing great, keep compounding those good habits!"
      });
      setIsGenerating(false);
    }, 3500);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">AI Report</h1>
        <p className="text-sm text-zinc-400 mt-1 font-medium">Connect your Gemini API key and receive detailed trading feedback based on your journal and trades.</p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (35%) - CONFIGURATION */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
            
            {/* Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Gemini Configuration</h2>
                <p className="text-[11px] text-zinc-500 font-medium">Your key remains private and is stored locally.</p>
              </div>
            </div>

            {/* API Key Input */}
            <div className="space-y-3 mb-8">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                Gemini API Key
                {keySaved && <span className="text-emerald-500 flex items-center gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" /> Connected</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    if (keySaved) setKeySaved(false);
                  }}
                  placeholder="Paste your Gemini API key..."
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-xl py-3 pl-10 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!keySaved && (
                <button 
                  onClick={handleSaveKey}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-colors border border-white/10 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Key
                </button>
              )}
            </div>

            <hr className="border-white/[0.05] my-6" />

            {/* Custom Instructions */}
            <div className="space-y-3 mb-8">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Custom Instructions (Optional)</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Example: Focus on overtrading, emotional mistakes, risk management, and what I should improve next week."
                className="w-full h-28 bg-[#121212] border border-white/[0.08] rounded-xl p-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none"
              />
            </div>

            {/* Report Type */}
            <div className="space-y-3 mb-8">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Report Type</label>
              <div className="flex flex-wrap gap-2">
                {(['Daily Review', 'Weekly Review', 'Monthly Review', 'Custom'] as ReportType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border ${
                      reportType === type 
                        ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                        : 'bg-[#121212] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Include Data */}
            <div className="space-y-4 mb-8">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Include Data</label>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {Object.entries(dataToggles).map(([key, value]) => {
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                        value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#121212] border-white/[0.15] text-transparent group-hover:border-white/30'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <span className={`text-[12px] font-semibold transition-colors ${value ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateReport}
              disabled={isGenerating || !keySaved}
              className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                !keySaved 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : isGenerating
                    ? 'bg-blue-600/50 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)]'
              }`}
            >
              {isGenerating ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Generating Report...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate AI Report</>
              )}
            </button>

          </div>
        </div>

        {/* RIGHT COLUMN (65%) - GENERATED REPORT */}
        <div className="xl:col-span-8">
          <div className="bg-[#0B0B0B] border border-white/[0.06] rounded-[24px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.4)] min-h-[800px] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.05]">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Generated Report</h2>
                <p className="text-xs text-zinc-500 font-medium mt-1">AI analysis based on your trading history.</p>
              </div>
              {report && (
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-white/5 border border-white/[0.08] text-xs font-bold text-zinc-300 transition-colors flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export PDF
                  </button>
                  <button className="px-3 py-1.5 rounded-lg bg-[#121212] hover:bg-white/5 border border-white/[0.08] text-xs font-bold text-zinc-300 transition-colors flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1">
              
              {/* State 1: Empty */}
              {!isGenerating && !report && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 mt-32">
                  <div className="w-20 h-20 rounded-3xl bg-blue-500/5 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <Sparkles className="w-10 h-10 text-blue-500 relative z-10" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">No report generated yet</h3>
                  <p className="text-sm text-zinc-500 max-w-md leading-relaxed font-medium">
                    Connect your Gemini API key and generate a report to discover strengths, weaknesses, recurring patterns, and improvement opportunities.
                  </p>
                </div>
              )}

              {/* State 2: Loading */}
              {isGenerating && (
                <div className="space-y-8 animate-pulse mt-8">
                  <div className="flex items-center justify-center gap-3 mb-12">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-sm font-bold text-blue-500 uppercase tracking-wider">Analyzing trading history...</span>
                  </div>
                  
                  <div className="h-32 bg-[#121212] border border-white/[0.03] rounded-2xl w-full" />
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="h-48 bg-[#121212] border border-white/[0.03] rounded-2xl w-full" />
                    <div className="h-48 bg-[#121212] border border-white/[0.03] rounded-2xl w-full" />
                  </div>
                  
                  <div className="h-40 bg-[#121212] border border-white/[0.03] rounded-2xl w-full" />
                  <div className="h-40 bg-[#121212] border border-white/[0.03] rounded-2xl w-full" />
                </div>
              )}

              {/* State 3: Report Exists */}
              {report && (
                <div className="space-y-6 animate-in fade-in duration-700">
                  
                  {/* 1. OVERALL GRADE */}
                  <div className="bg-[#121212] border border-white/[0.05] rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 blur-3xl rounded-full" />
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-500" /> Overall Assessment
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-500 uppercase">Grade</span>
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                          <span className="text-xl font-black text-white">{report.grade}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                      {[
                        { label: "Consistency", val: report.scores.consistency },
                        { label: "Discipline", val: report.scores.discipline },
                        { label: "Risk Mgmt", val: report.scores.risk },
                        { label: "Psychology", val: report.scores.psychology },
                      ].map(s => (
                        <div key={s.label} className="bg-[#0B0B0B] rounded-xl p-4 border border-white/[0.03]">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{s.label}</span>
                          <div className="flex items-end gap-2 mt-2">
                            <span className="text-xl font-black text-white leading-none">{s.val}</span>
                            <span className="text-[10px] text-zinc-500 font-bold mb-0.5">/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 2. STRENGTHS */}
                    <div className="bg-[#121212] border border-emerald-500/10 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Strengths
                      </h3>
                      <ul className="space-y-3">
                        {report.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 font-medium">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 3. WEAKNESSES */}
                    <div className="bg-[#121212] border border-red-500/10 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" /> Mistakes Detected
                      </h3>
                      <ul className="space-y-3">
                        {report.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 font-medium">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 4. BEHAVIOR PATTERNS */}
                  <div className="bg-[#121212] border border-white/[0.05] rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500" /> Behavior Patterns
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                      {[
                        { l: "Most Profitable Session", v: report.patterns.bestSession, c: "text-blue-400" },
                        { l: "Best Setup", v: report.patterns.bestSetup, c: "text-emerald-400" },
                        { l: "Worst Setup", v: report.patterns.worstSetup, c: "text-red-400" },
                        { l: "Average R:R", v: report.patterns.avgRR, c: "text-white" },
                        { l: "Common Emotion", v: report.patterns.commonEmotion, c: "text-amber-400" },
                        { l: "Most Repeated Mistake", v: report.patterns.mostRepeatedMistake, c: "text-zinc-300" },
                      ].map(p => (
                        <div key={p.l}>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">{p.l}</span>
                          <span className={`text-sm font-bold ${p.c}`}>{p.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 5. PSYCHOLOGY ANALYSIS */}
                    <div className="bg-[#121212] border border-amber-500/10 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" /> Psychology Analysis
                      </h3>
                      <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                        {report.psychology}
                      </p>
                    </div>

                    {/* 6. ACTION PLAN */}
                    <div className="bg-[#121212] border border-blue-500/10 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" /> Improvement Plan
                      </h3>
                      <div className="space-y-3">
                        {report.actionPlan.map((action: string, i: number) => (
                          <div key={i} className="flex gap-3 text-sm font-medium">
                            <span className="text-blue-500 font-black shrink-0">{i + 1}.</span>
                            <span className="text-zinc-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 7. AI COACH NOTES */}
                  <div className="bg-gradient-to-br from-blue-600/10 to-[#121212] border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden mt-4">
                    <div className="flex gap-4 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-blue-400 mb-1">Coach Notes</h3>
                        <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                          {report.coachNotes}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
