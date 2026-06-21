import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  type StrategySetup,
  HTF_TIMEFRAMES,
  LTF_TIMEFRAMES,
  CONFIRM_TIMEFRAMES,
  FIB_TIMEFRAMES,
  LEVEL_TYPES,
  CONFIRM_TYPES,
  CONFLUENCES,
  MARKET_SESSIONS,
  buildStrategySummary,
} from "@/lib/strategySetup";

type Props = {
  value: StrategySetup;
  onChange: (value: StrategySetup) => void;
};

const selectTriggerClass = "bg-[#060606] hover:bg-[#0B0B0B] border-zinc-900 hover:border-blue-600/[0.35] text-white h-11 rounded-[20px] transition-colors font-medium text-sm w-full";

function FieldSelect({
  label,
  value,
  options,
  onValueChange,
  placeholder = "Select",
}: {
  label: string;
  value: string;
  options: readonly string[];
  onValueChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5 block">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={selectTriggerClass}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-[#0b0b0b] border-zinc-800 text-white">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="focus:bg-zinc-800 focus:text-white cursor-pointer">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              "px-3.5 py-2 rounded-[20px] text-xs font-bold border transition-all duration-200 tracking-wide uppercase flex items-center gap-1.5",
              active
                ? "bg-blue-600/10 text-blue-500 border-blue-500/30"
                : "bg-[#060606] text-zinc-500 border-zinc-900 hover:text-zinc-300 hover:border-blue-600/[0.35]"
            )}
          >
            {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v)}
      className="grid grid-cols-2 bg-[#060606] p-1 rounded-[20px] border border-zinc-900 w-full gap-1"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt}
          value={opt}
          className={cn(
            "py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 h-9",
            value === opt
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300 bg-transparent"
          )}
        >
          {opt}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function StrategySetupCard({ value, onChange }: Props) {
  const summary = useMemo(() => buildStrategySummary(value), [value]);

  const update = (patch: Partial<StrategySetup>) => onChange({ ...value, ...patch });

  const toggleConfluence = (c: string) => {
    const next = value.confluences.includes(c)
      ? value.confluences.filter((x) => x !== c)
      : [...value.confluences, c];
    const patch: Partial<StrategySetup> = { confluences: next };
    if (c === "FIB Zone" && value.confluences.includes(c)) patch.fib_tf = "";
    update(patch);
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-[#0B0B0B]/80 backdrop-blur-xl shadow-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Strategy Setup</h3>
            <p className="text-xs text-zinc-500">Structured data collection for trade analysis.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Market Structure */}
        <div className="space-y-4">
          <div className="rounded-[20px] border border-white/[0.08] bg-[#0b0b0b] p-5 space-y-5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 border-b border-white/[0.05] pb-2">Market Structure</h4>
            
            <div className="space-y-4">
              {/* HTF Structure */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">HTF Structure</div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldSelect label="Timeframe" value={value.htf_tf} options={HTF_TIMEFRAMES} onValueChange={(v) => update({ htf_tf: v })} />
                  <FieldSelect label="Level Type" value={value.htf_level} options={LEVEL_TYPES} onValueChange={(v) => update({ htf_level: v })} />
                </div>
              </div>

              {/* LTF Structure */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">LTF Structure</div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldSelect label="Timeframe" value={value.ltf_tf} options={LTF_TIMEFRAMES} onValueChange={(v) => update({ ltf_tf: v })} />
                  <FieldSelect label="Level Type" value={value.ltf_level} options={LEVEL_TYPES} onValueChange={(v) => update({ ltf_level: v })} />
                </div>
              </div>

              {/* Confirmation */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Confirmation</div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldSelect label="Timeframe" value={value.conf_tf} options={CONFIRM_TIMEFRAMES} onValueChange={(v) => update({ conf_tf: v })} />
                  <FieldSelect label="Type" value={value.conf_type} options={CONFIRM_TYPES} onValueChange={(v) => update({ conf_type: v })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Confluences */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="rounded-[20px] border border-white/[0.08] bg-[#0b0b0b] p-5 space-y-5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 border-b border-white/[0.05] pb-2">Parameters & Confluences</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1.5 block">Bias</Label>
                <SegmentedControl
                  value={value.bias}
                  options={["Bullish", "Bearish"]}
                  onChange={(v) => update({ bias: v })}
                />
              </div>
              <div>
                <FieldSelect
                  label="Market Session"
                  value={value.market_session}
                  options={MARKET_SESSIONS}
                  onValueChange={(v) => update({ market_session: v })}
                />
              </div>
            </div>

            <div>
              <Label className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2 block">Confluences</Label>
              <ChipGroup options={CONFLUENCES} selected={value.confluences} onToggle={toggleConfluence} />
              
              <AnimatePresence>
                {value.confluences.includes("FIB Zone") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 max-w-xs">
                      <FieldSelect
                        label="Fib Zone Timeframe"
                        value={value.fib_tf}
                        options={FIB_TIMEFRAMES}
                        onValueChange={(v) => update({ fib_tf: v })}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Setup Summary */}
          <div className="rounded-[20px] border border-blue-500/15 bg-blue-950/10 p-5 mt-auto">
            <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 mb-2.5">Setup Summary</div>
            {summary ? (
              <pre className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">{summary}</pre>
            ) : (
              <p className="text-xs text-zinc-500">No active parameters selected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
