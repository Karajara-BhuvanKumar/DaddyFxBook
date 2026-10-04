import { useState, useCallback } from "react";
import { SlidersHorizontal, CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// ─── Types ────────────────────────────────────────────────────
export type DirectionFilter = "All" | "Long" | "Short";
export type DateRangePreset = "1W" | "1M" | "3M" | "All Time" | "Custom";
export type SortOption = "newest" | "oldest" | "pnl-desc" | "pnl-asc";

export interface TradeFilters {
  direction: DirectionFilter;
  dateRange: DateRangePreset;
  sortBy: SortOption;
  customStart: Date | undefined;
  customEnd: Date | undefined;
}

export const DEFAULT_FILTERS: TradeFilters = {
  direction: "All",
  dateRange: "All Time",
  sortBy: "newest",
  customStart: undefined,
  customEnd: undefined,
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest First",
  oldest: "Oldest First",
  "pnl-desc": "Profit: High → Low",
  "pnl-asc": "Profit: Low → High",
};

export function isFiltersActive(filters: TradeFilters): boolean {
  return (
    filters.direction !== DEFAULT_FILTERS.direction ||
    filters.dateRange !== DEFAULT_FILTERS.dateRange ||
    filters.sortBy !== DEFAULT_FILTERS.sortBy
  );
}

// ─── Component ────────────────────────────────────────────────
interface TradeHistoryFiltersProps {
  filters: TradeFilters;
  onApply: (filters: TradeFilters) => void;
}

export default function TradeHistoryFilters({ filters, onApply }: TradeHistoryFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TradeFilters>(filters);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);

  const active = isFiltersActive(filters);

  // Sync draft when popover opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setDraft(filters);
        setDateError(null);
        setShowSortDropdown(false);
        setShowStartCal(false);
        setShowEndCal(false);
      }
      setOpen(isOpen);
    },
    [filters],
  );

  function handleApply() {
    if (draft.dateRange === "Custom") {
      if (draft.customStart && draft.customEnd && draft.customStart > draft.customEnd) {
        setDateError("Start date must be before end date");
        return;
      }
    }
    setDateError(null);
    onApply(draft);
    setOpen(false);
  }

  function handleReset() {
    const reset = { ...DEFAULT_FILTERS };
    setDraft(reset);
    setDateError(null);
    onApply(reset);
    setOpen(false);
  }

  // ── Pill button helper ────────────────────────────────────
  function Pill({
    label,
    selected,
    onClick,
  }: {
    label: string;
    selected: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        {label}
      </button>
    );
  }

  const formatCalDate = (d: Date | undefined) =>
    d
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Select";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="touch-target w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] border border-border text-muted-foreground hover:text-foreground text-[13px] font-semibold bg-secondary hover:bg-muted transition-all">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters{" "}
          {active && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 shadow-xl"
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <h4 className="text-[14px] font-bold text-foreground tracking-tight">Filters</h4>

          {/* ── Direction ──────────────────────────────────── */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Direction
            </span>
            <div className="flex gap-2">
              {(["All", "Long", "Short"] as DirectionFilter[]).map((d) => (
                <Pill
                  key={d}
                  label={d}
                  selected={draft.direction === d}
                  onClick={() => setDraft((f) => ({ ...f, direction: d }))}
                />
              ))}
            </div>
          </div>

          {/* ── Date Range ─────────────────────────────────── */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Date Range
            </span>
            <div className="flex flex-wrap gap-2">
              {(["1W", "1M", "3M", "All Time", "Custom"] as DateRangePreset[]).map((preset) => (
                <Pill
                  key={preset}
                  label={preset}
                  selected={draft.dateRange === preset}
                  onClick={() => {
                    setDraft((f) => ({ ...f, dateRange: preset }));
                    setDateError(null);
                    if (preset !== "Custom") {
                      setShowStartCal(false);
                      setShowEndCal(false);
                    }
                  }}
                />
              ))}
            </div>

            {/* Custom date pickers */}
            {draft.dateRange === "Custom" && (
              <div className="mt-3 space-y-3">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Start Date
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartCal((v) => !v);
                      setShowEndCal(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-input text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatCalDate(draft.customStart)}
                    </span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {showStartCal && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={draft.customStart}
                        onSelect={(day) => {
                          setDraft((f) => ({ ...f, customStart: day ?? undefined }));
                          setShowStartCal(false);
                          setDateError(null);
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </div>
                  )}
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    End Date
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndCal((v) => !v);
                      setShowStartCal(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-input text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatCalDate(draft.customEnd)}
                    </span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                  {showEndCal && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={draft.customEnd}
                        onSelect={(day) => {
                          setDraft((f) => ({ ...f, customEnd: day ?? undefined }));
                          setShowEndCal(false);
                          setDateError(null);
                        }}
                        disabled={{ after: new Date() }}
                        initialFocus
                      />
                    </div>
                  )}
                </div>

                {dateError && (
                  <p className="text-[11px] text-loss font-medium">{dateError}</p>
                )}
              </div>
            )}
          </div>

          {/* ── Sort By ────────────────────────────────────── */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Sort By
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortDropdown((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-input text-[12px] font-semibold text-foreground hover:bg-muted transition-colors"
              >
                {SORT_LABELS[draft.sortBy]}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${
                    showSortDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showSortDropdown && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-lg">
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDraft((f) => ({ ...f, sortBy: key }));
                        setShowSortDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[12px] font-medium transition-colors ${
                        draft.sortBy === key
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <button
            type="button"
            onClick={handleReset}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-[20px] bg-primary text-primary-foreground text-[12px] font-bold hover:bg-primary/90 transition-all"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
