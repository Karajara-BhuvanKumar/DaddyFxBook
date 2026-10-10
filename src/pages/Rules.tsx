import { RULE_TYPE_OPTIONS, SESSION_OPTIONS, needsRuleThreshold, validateRuleConfiguration, ruleBadge, type RuleType } from '@/lib/ruleConfiguration';
import LoadError from '@/components/LoadError';
import { useState } from "react";
import { Scale, Plus, Pencil, Trash2, Zap, ShieldCheck, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import migrationSql from "../../supabase/migrations/20260920_rules_page.sql?raw";
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
import { useRules, useRulesSchemaStatus } from "@/hooks/useRules";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_IDEAS: { text: string; type?: RuleType; threshold?: number }[] = [
  { text: 'Maximum 3 trades per day', type: 'max_trades_per_day', threshold: 3 },
  { text: 'Stop trading after 2 consecutive losses', type: 'max_consecutive_losses', threshold: 2 },
  { text: 'Only take A+ setups from the plan' },
  { text: 'Risk 1% or less per trade', type: 'max_risk_per_trade', threshold: 1 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Rules() {
  const { rules, isLoading, error, refetch, addRule, updateRule, deleteRule } = useRules();
  const { outdated } = useRulesSchemaStatus();

  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("manual");
  const [threshold, setThreshold] = useState<string>("");

  const [allowedSessions, setAllowedSessions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const resetForm = () => { setText(''); setRuleType('manual'); setThreshold(''); setAllowedSessions([]); setEditingId(null); };
  const needsThreshold = needsRuleThreshold(ruleType);
  const thresholdLabel = RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.thresholdLabel ?? "Threshold";

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return toast({ title: "Rule text is required", variant: "destructive" });
    if (trimmed.length > 200) return toast({ title: "Rule text too long", description: "Max 200 characters", variant: "destructive" });
    const validationError = validateRuleConfiguration(ruleType, needsThreshold && threshold.trim() ? Number(threshold) : null, allowedSessions);
    if (validationError) return toast({ title: validationError, variant: 'destructive' });
    const input = { rule: trimmed, rule_type: ruleType, threshold: needsThreshold ? Number(threshold) : null, allowed_sessions: ruleType === 'permitted_sessions' ? allowedSessions : [] };
    if (editingId) updateRule.mutate({ id: editingId, patch: input }, { onSuccess: resetForm });
    else addRule.mutate(input, { onSuccess: resetForm });
  };

  const handleQuickIdea = (idea: (typeof QUICK_IDEAS)[number]) => {
    setEditingId(null); setAllowedSessions([]);
    setText(idea.text);
    if (idea.type) {
      setRuleType(idea.type);
      setThreshold(idea.threshold?.toString() ?? "");
    } else {
      setRuleType("manual");
      setThreshold("");
    }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(migrationSql); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast({ title: 'Could not copy. Check clipboard permissions.', variant: 'destructive' }); }
  };

  return (
    <div className="overflow-guard space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 md:pb-12">
      {outdated && (
        <Alert className="bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/20 relative">
          <AlertTriangle className="h-4 w-4 stroke-amber-500" />
          <AlertTitle className="text-amber-700 dark:text-amber-500 font-semibold">Database update required</AlertTitle>
          <AlertDescription className="mt-2 text-sm leading-relaxed text-amber-700/90 dark:text-amber-500/90 pr-24">
            Your database is missing the latest Rules migration. Run <code>supabase/migrations/20260920_rules_page.sql</code> in the Supabase SQL Editor, then refresh this page.
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="absolute top-4 right-4 h-8 bg-background/50 border-amber-500/30 text-amber-700 dark:text-amber-500 hover:bg-amber-500/20"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy SQL
          </Button>
        </Alert>
      )}

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
            <h2 className="text-lg font-bold text-foreground tracking-tight">{editingId ? "Edit Rule" : "Add Rule"}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Define a trading rule you want to track. Pick a type for automatic monitoring.
          </p>

          {/* Textarea */}
          <Textarea
            aria-label="Rule description"
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
                  <SelectItem 
                    key={o.value} 
                    value={o.value} 
                    disabled={outdated && o.value !== "manual"}
                    className="rounded-lg cursor-pointer focus:bg-muted/50 focus:text-foreground"
                  >
                    {o.label} {outdated && o.value !== "manual" && "(Update DB)"}
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
                aria-label={thresholdLabel}
                min={ruleType === "max_risk_per_trade" || ruleType === "max_daily_loss" ? "0.01" : "1"}
                step={ruleType === "max_risk_per_trade" || ruleType === "max_daily_loss" ? "any" : "1"}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 3"
                className="bg-input border-border/60 h-11 rounded-xl focus-visible:ring-primary font-mono"
              />
            </div>
          )}

          {ruleType === 'permitted_sessions' && <fieldset className="mb-4 space-y-2">
            <legend className="text-xs font-semibold mb-2">Permitted entry sessions · IST</legend>
            {SESSION_OPTIONS.map(session => <label key={session.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowedSessions.includes(session.id)} onChange={e => setAllowedSessions(current => e.target.checked ? [...current, session.id] : current.filter(id => id !== session.id))} />
              {session.name} · {session.hours}{session.id === 'new-york' ? ' (ends next day)' : ''}
            </label>)}
            <p className="text-xs text-muted-foreground">Any selected session permits entry, including overlaps. Hours follow the Analysis session clock.</p>
          </fieldset>}
          {ruleType === 'max_risk_per_trade' && <p className="text-xs text-muted-foreground mb-4">Checks the recorded risk percentage on each trade. Trades with unknown risk are skipped.</p>}
          {/* Add button */}
          <Button
            onClick={handleAdd}
            disabled={addRule.isPending || updateRule.isPending}
            className="w-full h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            {addRule.isPending || updateRule.isPending ? "Saving..." : editingId ? "Save Rule" : "Add Rule"}
          </Button>

          {editingId && <Button variant="ghost" onClick={resetForm} className="mt-2">Cancel editing</Button>}
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

          {error ? <LoadError name="your rules" retry={refetch} /> : isLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
              Loading rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-muted-foreground dark:text-muted-foreground/30 mb-3" />
              <h3 className="font-medium text-foreground">No rules defined</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Add your first trading rule to start tracking discipline and improving consistency.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {rules.map((r, idx) => {
                const badge = ruleBadge(r.rule_type, r.threshold, r.allowed_sessions);
                return (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-colors group"
                  >
                    <Switch
                      aria-label={`Enable rule: ${r.rule}`} disabled={updateRule.isPending} checked={r.active}
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
                    <Button size="icon" variant="ghost" aria-label={'Edit rule: ' + r.rule} className="h-8 w-8 shrink-0" onClick={() => { setEditingId(r.id); setText(r.rule); setRuleType(r.rule_type as RuleType); setThreshold(r.threshold?.toString() ?? ''); setAllowedSessions(r.allowed_sessions ?? []); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete rule: ${r.rule}`} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg shrink-0"
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
