import { useState } from "react";
import { Scale, Plus, Trash2, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRules } from "@/hooks/useRules";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type RuleType = "manual" | "max_trades_per_day" | "max_consecutive_losses" | "max_daily_loss";

const RULE_TYPE_OPTIONS: { value: RuleType; label: string; thresholdLabel?: string }[] = [
  { value: "manual", label: "Manual (self-checked)" },
  { value: "max_trades_per_day", label: "Max trades per day", thresholdLabel: "Max trades" },
  { value: "max_consecutive_losses", label: "Stop after N consecutive losses", thresholdLabel: "Max consecutive losses" },
  { value: "max_daily_loss", label: "Max daily loss", thresholdLabel: "Max loss ($)" },
];

const QUICK_IDEAS: { text: string; type?: RuleType; threshold?: number }[] = [
  { text: "Maximum 3 trades per day", type: "max_trades_per_day", threshold: 3 },
  { text: "Stop trading after 2 consecutive losses", type: "max_consecutive_losses", threshold: 2 },
  { text: "Only take A+ setups from the plan" },
  { text: "Risk 1% or less per trade" },
];

function autoTypeBadge(ruleType: string, threshold: number | null): string | null {
  if (ruleType === "max_trades_per_day" && threshold) return `Auto: max ${threshold}/day`;
  if (ruleType === "max_consecutive_losses" && threshold) return `Auto: stop after ${threshold} losses`;
  if (ruleType === "max_daily_loss" && threshold) return `Auto: max loss $${threshold}`;
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Rules() {
  const { rules, isLoading, addRule, updateRule, deleteRule } = useRules();

  const [text, setText] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("manual");
  const [threshold, setThreshold] = useState<string>("");

  const needsThreshold = ruleType !== "manual";
  const thresholdLabel = RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.thresholdLabel ?? "Threshold";

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return toast({ title: "Rule text is required", variant: "destructive" });
    if (trimmed.length > 200) return toast({ title: "Rule text too long", description: "Max 200 characters", variant: "destructive" });
    if (needsThreshold && (!threshold || Number(threshold) <= 0)) {
      return toast({ title: "Threshold must be greater than 0", variant: "destructive" });
    }
    addRule.mutate(
      { rule: trimmed, rule_type: ruleType, threshold: needsThreshold ? Number(threshold) : null },
      {
        onSuccess: () => {
          setText("");
          setRuleType("manual");
          setThreshold("");
        },
      },
    );
  };

  const handleQuickIdea = (idea: (typeof QUICK_IDEAS)[number]) => {
    setText(idea.text);
    if (idea.type) {
      setRuleType(idea.type);
      setThreshold(idea.threshold?.toString() ?? "");
    } else {
      setRuleType("manual");
      setThreshold("");
    }
  };

  return (
    <div className="overflow-guard space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="page-title font-bold tracking-tight">Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Store challenge rules and personal discipline rules for Main Account.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Add Rule */}
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">Add Rule</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Define a trading rule you want to track. Pick a type for automatic monitoring.
          </p>

          {/* Textarea */}
          <Textarea
            placeholder="Write a rule, for example: Maximum 3 trades per day."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            className="bg-input border-border/60 rounded-xl min-h-[80px] resize-none focus-visible:ring-primary mb-4"
          />

          {/* Rule type selector */}
          <div className="mb-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Rule type
            </Label>
            <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
              <SelectTrigger className="bg-input border-border/60 h-11 rounded-xl focus:ring-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl">
                {RULE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="rounded-lg cursor-pointer focus:bg-muted/50 focus:text-foreground">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Threshold (conditional) */}
          {needsThreshold && (
            <div className="mb-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                {thresholdLabel}
              </Label>
              <Input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 3"
                className="bg-input border-border/60 h-11 rounded-xl focus-visible:ring-primary font-mono"
              />
            </div>
          )}

          {/* Add button */}
          <Button
            onClick={handleAdd}
            disabled={addRule.isPending}
            className="w-full h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            {addRule.isPending ? "Adding..." : "Add Rule"}
          </Button>

          {/* Quick Ideas */}
          <div className="mt-6 pt-5 border-t border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Quick Ideas
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_IDEAS.map((idea) => (
                <button
                  key={idea.text}
                  onClick={() => handleQuickIdea(idea)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-muted/40 text-muted-foreground border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                >
                  {idea.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Active Rules */}
        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">Active Rules</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Main Account</p>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-medium text-foreground">No rules defined</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Add your first trading rule to start tracking discipline and improving consistency.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {rules.map((r, idx) => {
                const badge = autoTypeBadge(r.rule_type, r.threshold);
                return (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-colors group"
                  >
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => updateRule.mutate({ id: r.id, patch: { active: v } })}
                      className="data-[state=checked]:bg-primary mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Rule {idx + 1}
                      </p>
                      <p className={`text-sm font-medium ${r.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {r.rule}
                      </p>
                      {badge && (
                        <Badge variant="secondary" className="mt-1.5 text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
                          {badge}
                        </Badge>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{r.rule}" and all associated violation flags. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRule.mutate(r.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
