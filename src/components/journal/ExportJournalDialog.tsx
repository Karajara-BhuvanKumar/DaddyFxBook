import { useState } from "react";
import { Download, FileText, FileSpreadsheet, File, Calendar as CalendarIcon, Check } from "lucide-react";
import { format, subDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { fetchExportData } from "@/hooks/useTrades";
import { exportToCSV, exportToExcel, exportToWord, exportToPDF } from "@/lib/exportUtils";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const EXPORT_FIELDS = [
  { id: "date", label: "Date and Time" },
  { id: "symbol", label: "Symbol" },
  { id: "direction", label: "Direction" },
  { id: "entryPrice", label: "Entry Price" },
  { id: "exitPrice", label: "Exit Price" },
  { id: "pnl", label: "P&L" },
  { id: "riskReward", label: "Risk Reward" },
  { id: "strategySetup", label: "Strategy Setup" },
  { id: "preTrade", label: "Pre-Trade Analysis" },
  { id: "postTrade", label: "Post-Trade Review" },
  { id: "emotions", label: "Emotions" },
  { id: "lessons", label: "Lessons Learned" },
  { id: "tags", label: "Tags" },
  { id: "rating", label: "Rating" },
  { id: "session", label: "Session Information" },
];

const EXPORT_FORMATS = [
  { id: "pdf", label: "PDF", description: "Beautiful report with cards and screenshots.", icon: File },
  { id: "docx", label: "WORD (.docx)", description: "Editable document.", icon: FileText },
  { id: "xlsx", label: "EXCEL (.xlsx)", description: "Spreadsheet with multiple sheets.", icon: FileSpreadsheet },
  { id: "csv", label: "CSV", description: "Raw tabular data.", icon: FileText },
];

export function ExportJournalDialog() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dateRange, setDateRange] = useState("all");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  
  const [fields, setFields] = useState<Record<string, boolean>>(
    EXPORT_FIELDS.reduce((acc, field) => ({ ...acc, [field.id]: true }), {})
  );
  
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["pdf"]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    setExportProgress("Preparing journal...");
    
    try {
      let startDateStr: string | undefined;
      let endDateStr: string | undefined;

      const now = new Date();
      if (dateRange === "7") startDateStr = subDays(now, 7).toISOString();
      else if (dateRange === "30") startDateStr = subDays(now, 30).toISOString();
      else if (dateRange === "90") startDateStr = subDays(now, 90).toISOString();
      else if (dateRange === "custom" && customRange.from && customRange.to) {
        startDateStr = customRange.from.toISOString();
        endDateStr = customRange.to.toISOString();
      }

      setExportProgress("Fetching data...");
      const data = await fetchExportData(user.id, startDateStr, endDateStr);
      
      const options = { includeFields: fields, formats: selectedFormats };
      
      if (selectedFormats.includes("csv")) {
        setExportProgress("Generating CSV...");
        exportToCSV(data, options);
      }
      
      if (selectedFormats.includes("xlsx")) {
        setExportProgress("Generating Excel...");
        exportToExcel(data, options);
      }
      
      if (selectedFormats.includes("docx")) {
        setExportProgress("Generating Word document...");
        await exportToWord(data, options);
      }
      
      if (selectedFormats.includes("pdf")) {
        setExportProgress("Generating PDF...");
        exportToPDF(data, options);
      }
      
      setExportProgress("Export complete.");
      setTimeout(() => {
        setIsExporting(false);
        setIsOpen(false);
        setExportProgress("");
      }, 1500);

    } catch (error) {
      console.error(error);
      setIsExporting(false);
      setExportProgress("Export failed.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-bold text-xs transition-colors shadow-[0_4px_30px_rgba(37,99,235,0.2)]">
          <Download className="w-4 h-4" /> Export Journal
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl bg-[#0B0B0B] border-white/[0.06] rounded-[24px] shadow-2xl p-0 gap-0 overflow-hidden text-foreground max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 border-b border-white/[0.06] shrink-0">
          <DialogTitle className="text-2xl font-bold">Export Trading Journal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Download your journal entries and all associated trade data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Date Range */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-500" /> Date Range
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Time" },
                { id: "7", label: "Last 7 Days" },
                { id: "30", label: "Last 30 Days" },
                { id: "90", label: "Last 90 Days" },
                { id: "custom", label: "Custom Date Range" }
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id)}
                  className={cn(
                    "px-4 py-2 rounded-[20px] border text-xs font-bold transition-all",
                    dateRange === range.id
                      ? "bg-blue-500/10 border-blue-500/50 text-blue-500"
                      : "bg-[#050505] border-white/[0.06] text-muted-foreground hover:bg-white/[0.02]"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {dateRange === "custom" && (
              <div className="flex items-center gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 w-48 px-3 py-2 rounded-xl bg-[#050505] border border-white/[0.06] text-sm hover:bg-white/[0.02] transition-colors">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {customRange.from ? format(customRange.from, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-white/[0.06] bg-[#0B0B0B]" align="start">
                      <Calendar
                        mode="single"
                        selected={customRange.from}
                        onSelect={(date) => setCustomRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 w-48 px-3 py-2 rounded-xl bg-[#050505] border border-white/[0.06] text-sm hover:bg-white/[0.02] transition-colors">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {customRange.to ? format(customRange.to, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-white/[0.06] bg-[#0B0B0B]" align="start">
                      <Calendar
                        mode="single"
                        selected={customRange.to}
                        onSelect={(date) => setCustomRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                        disabled={(date) => customRange.from ? date < customRange.from : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* What to Include */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-500" /> What to Include
              </h3>
              <button 
                onClick={() => {
                  const allChecked = Object.values(fields).every(Boolean);
                  setFields(EXPORT_FIELDS.reduce((acc, f) => ({ ...acc, [f.id]: !allChecked }), {}));
                }}
                className="text-xs text-blue-500 font-semibold hover:underline"
              >
                Toggle All
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {EXPORT_FIELDS.map(field => (
                <label
                  key={field.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                    fields[field.id]
                      ? "bg-blue-500/5 border-blue-500/30"
                      : "bg-[#050505] border-white/[0.06] hover:bg-white/[0.02]"
                  )}
                >
                  <Checkbox
                    checked={fields[field.id]}
                    onCheckedChange={(checked) => setFields(prev => ({ ...prev, [field.id]: checked as boolean }))}
                    className="border-white/[0.2] data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <span className={cn(
                    "text-xs font-semibold",
                    fields[field.id] ? "text-blue-500" : "text-muted-foreground"
                  )}>{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Export Formats */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-500" /> Export Formats
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {EXPORT_FORMATS.map(format => {
                const Icon = format.icon;
                const isSelected = selectedFormats.includes(format.id);
                return (
                  <button
                    key={format.id}
                    onClick={() => {
                      setSelectedFormats(prev => 
                        prev.includes(format.id)
                          ? prev.filter(id => id !== format.id)
                          : [...prev, format.id]
                      );
                    }}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-[20px] border text-left transition-all",
                      isSelected
                        ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                        : "bg-[#050505] border-white/[0.06] hover:bg-white/[0.04]"
                    )}
                  >
                    <div className={cn(
                      "p-2.5 rounded-xl border shrink-0",
                      isSelected ? "bg-blue-500 border-blue-400 text-white" : "bg-[#0B0B0B] border-white/[0.08] text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={cn("text-sm font-bold mb-1", isSelected ? "text-blue-500" : "text-white")}>
                        {format.label}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                        {format.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-white/[0.06] bg-[#050505] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExporting && (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="text-sm font-bold text-blue-500 animate-pulse">{exportProgress}</span>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isExporting} className="rounded-[20px] border-white/[0.08] text-white hover:bg-white/[0.02]">
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || selectedFormats.length === 0}
              className="rounded-[20px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 shadow-[0_4px_20px_rgba(37,99,235,0.2)]"
            >
              Export Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
