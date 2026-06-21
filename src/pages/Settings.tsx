import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings, ACCENT_COLORS } from "@/hooks/useUserSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  User, Settings as SettingsIcon, ShieldCheck, Clock, Palette, Bell, Database, Lock, Info,
  Upload, Plus, Trash2, Download, LogOut, KeyRound, ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore",
  "Asia/Dubai", "Australia/Sydney",
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];
const SESSIONS = ["Asian", "London", "New York"];

const APP_VERSION = "1.5.0";
const BUILD_VERSION = "2026.06.21";
const SUBSCRIPTION = "Elite";

type Rule = { id: string; rule: string; active: boolean; position: number };

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCSV(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id ?? "";
  
  const { settings, isLoading, updateSettingsAsync, uploadAvatar } = useUserSettings();

  const fileInput = useRef<HTMLInputElement>(null);
  const [newRule, setNewRule] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  const { data: rules = [] } = useQuery({
    queryKey: ["trading_rules", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_rules").select("*").eq("user_id", uid).order("position");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const addRule = useMutation({
    mutationFn: async (rule: string) => {
      const { error } = await supabase.from("trading_rules").insert({
        user_id: uid, rule, position: rules.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewRule(""); qc.invalidateQueries({ queryKey: ["trading_rules", uid] }); },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Rule> }) => {
      const { error } = await supabase.from("trading_rules").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trading_rules", uid] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trading_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trading_rules", uid] }),
  });

  const exportTable = async (table: "trades" | "journals" | "backtest_sessions", filename: string) => {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", uid);
    if (error) return toast({ title: "Export failed", description: error.message, variant: "destructive" });
    if (!data?.length) return toast({ title: "Nothing to export" });
    downloadCSV(filename, toCSV(data));
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return toast({ title: "Password too short", description: "Min 8 characters", variant: "destructive" });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setNewPassword("");
    toast({ title: "Password updated" });
  };

  const signOutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast({ title: "Signed out from all devices" });
  };

  const utcNow = useMemo(() => new Date().toUTCString(), []);
  const istNow = useMemo(
    () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }),
    [],
  );

  if (isLoading || !settings) {
    return <div className="text-muted-foreground py-20 text-center animate-pulse">Loading workspace settings...</div>;
  }

  const initials = (settings.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  const TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "trading", label: "Trading", icon: SettingsIcon },
    { id: "rules", label: "Rules", icon: ShieldCheck },
    { id: "time", label: "Time", icon: Clock },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notify", icon: Bell },
    { id: "data", label: "Data", icon: Database },
    { id: "security", label: "Security", icon: Lock },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <div className="mt-6 pb-12 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace preferences, identity, and security.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6 font-medium rounded-xl h-11"
            onClick={() => toast({ title: "Settings automatically saved" })}
          >
            All changes saved
          </Button>
        </div>
      </div>

      {/* Custom Animated Tab Bar */}
      <div className="relative flex w-full overflow-x-auto overflow-y-hidden pb-1 scrollbar-none border-b border-border">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap outline-none
                ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(var(--primary),0.3)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="min-h-[500px]">

        {/* PROFILE */}
        {activeTab === "profile" && (
          <SettingsCard title="Profile" description="Your identity across DaddyFXBook.">
            <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-muted/20 border border-border/50">
              <Avatar className="h-24 w-24 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarImage src={settings.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-3 flex-1 text-center md:text-left">
                <h3 className="font-semibold text-lg">{settings.display_name || "Set a display name"}</h3>
                <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-2">
                  <input
                    ref={fileInput} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }}
                  />
                  <Button variant="secondary" onClick={() => fileInput.current?.click()} className="rounded-lg h-9">
                    <Upload className="h-4 w-4 mr-2" /> Upload picture
                  </Button>
                  {settings.avatar_url && (
                    <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-9" onClick={() => updateSettingsAsync({ avatar_url: null })}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG. Max 2MB recommended.</p>
              </div>
            </div>
            
            <Separator className="my-6 bg-border/50" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Display name">
                <Input 
                  value={settings.display_name ?? ""} 
                  onChange={(e) => updateSettingsAsync({ display_name: e.target.value })} 
                  placeholder="Your name" 
                  className="bg-input border-border/60 focus-visible:ring-primary h-11 rounded-xl"
                />
              </Field>
              <Field label="Username">
                <Input 
                  value={settings.username ?? ""} 
                  onChange={(e) => updateSettingsAsync({ username: e.target.value })} 
                  placeholder="username" 
                  className="bg-input border-border/60 focus-visible:ring-primary h-11 rounded-xl"
                />
              </Field>
              <Field label="Email (read-only)">
                <Input value={user?.email ?? ""} disabled className="bg-muted/50 border-border/30 h-11 rounded-xl text-muted-foreground opacity-100" />
              </Field>
              <Field label="Timezone">
                <SelectInput value={settings.timezone} onChange={(v) => updateSettingsAsync({ timezone: v })} options={TIMEZONES} />
              </Field>
              <Field label="Time format">
                <SelectInput value={settings.time_format} onChange={(v) => updateSettingsAsync({ time_format: v })} options={["12h", "24h"]} />
              </Field>
              <Field label="Default currency">
                <SelectInput value={settings.currency} onChange={(v) => updateSettingsAsync({ currency: v })} options={CURRENCIES} />
              </Field>
              <Field label="Account size">
                <Input 
                  type="number" 
                  value={settings.account_size} 
                  onChange={(e) => updateSettingsAsync({ account_size: Number(e.target.value) })} 
                  className="bg-input border-border/60 focus-visible:ring-primary h-11 rounded-xl font-mono"
                />
              </Field>
            </div>
          </SettingsCard>
        )}

        {/* TRADING PREFERENCES */}
        {activeTab === "trading" && (
          <SettingsCard title="Trading Preferences" description="Define risk envelope and execution defaults.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Default risk %">
                <Input type="number" step="0.1" value={settings.default_risk_pct}
                  onChange={(e) => updateSettingsAsync({ default_risk_pct: Number(e.target.value) })} className="bg-input border-border/60 h-11 rounded-xl" />
              </Field>
              <Field label="Max daily risk (%)">
                <Input type="number" step="0.1" value={settings.max_daily_risk}
                  onChange={(e) => updateSettingsAsync({ max_daily_risk: Number(e.target.value) })} className="bg-input border-border/60 h-11 rounded-xl" />
              </Field>
              <Field label="Max weekly risk (%)">
                <Input type="number" step="0.1" value={settings.max_weekly_risk}
                  onChange={(e) => updateSettingsAsync({ max_weekly_risk: Number(e.target.value) })} className="bg-input border-border/60 h-11 rounded-xl" />
              </Field>
              <Field label="Max trades / day">
                <Input type="number" value={settings.max_trades_per_day}
                  onChange={(e) => updateSettingsAsync({ max_trades_per_day: Number(e.target.value) })} className="bg-input border-border/60 h-11 rounded-xl" />
              </Field>
              <Field label="Preferred session">
                <SelectInput value={settings.preferred_session} onChange={(v) => updateSettingsAsync({ preferred_session: v })} options={SESSIONS} />
              </Field>
            </div>
          </SettingsCard>
        )}

        {/* RULES */}
        {activeTab === "rules" && (
          <SettingsCard title="Trading Rules" description="Your personal commandments. AI reports check trades against active rules.">
            <div className="flex gap-3 mb-6">
              <Input 
                placeholder="e.g. Only trade London session..." 
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newRule.trim() && addRule.mutate(newRule.trim())} 
                className="bg-input border-border/60 h-11 rounded-xl flex-1 focus-visible:ring-primary"
              />
              <Button 
                onClick={() => newRule.trim() && addRule.mutate(newRule.trim())}
                className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>
            
            <div className="space-y-3">
              {rules.length === 0 && (
                <div className="p-10 border border-dashed border-border rounded-xl text-center flex flex-col items-center">
                  <ShieldCheck className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                  <h3 className="font-medium text-foreground">No rules defined</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add your first trading rule above to strengthen your discipline.</p>
                </div>
              )}
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors group">
                  <Switch checked={r.active} onCheckedChange={(v) => updateRule.mutate({ id: r.id, patch: { active: v } })} className="data-[state=checked]:bg-primary" />
                  <Input
                    defaultValue={r.rule}
                    onBlur={(e) => e.target.value !== r.rule && updateRule.mutate({ id: r.id, patch: { rule: e.target.value } })}
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto font-medium"
                  />
                  <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </SettingsCard>
        )}

        {/* TIME */}
        {activeTab === "time" && (
          <SettingsCard title="Time Settings" description="All trades are stored in UTC. Display follows your timezone.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">UTC Reference</p>
                <p className="font-mono text-xl font-bold">{utcNow}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Local (IST)</p>
                <p className="font-mono text-xl font-bold">{istNow}</p>
              </div>
            </div>
            <div className="max-w-md">
              <Field label="Your timezone">
                <SelectInput value={settings.timezone} onChange={(v) => updateSettingsAsync({ timezone: v })} options={TIMEZONES} />
              </Field>
            </div>
          </SettingsCard>
        )}

        {/* APPEARANCE */}
        {activeTab === "appearance" && (
          <SettingsCard title="Appearance" description="Personalize your workspace aesthetics.">
            <div className="space-y-8">
              <Field label="Theme Preference">
                <div className="grid grid-cols-3 gap-3">
                  {["dark", "light", "system"].map((t) => (
                    <button 
                      key={t} 
                      onClick={() => updateSettingsAsync({ theme: t })} 
                      className={`
                        h-12 rounded-xl flex items-center justify-center capitalize font-medium transition-all border
                        ${settings.theme === t 
                          ? "bg-primary/10 border-primary text-primary shadow-sm" 
                          : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        }
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              
              <Field label="Accent Color">
                <div className="flex flex-wrap gap-4">
                  {ACCENT_COLORS.map((c) => (
                    <button 
                      key={c.id} 
                      onClick={() => updateSettingsAsync({ accent_color: c.id })}
                      className={`
                        h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300
                        ${settings.accent_color === c.id ? "scale-110 shadow-[0_0_15px_rgba(0,0,0,0.2)] ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-105 opacity-80 hover:opacity-100"}
                      `}
                      style={{ background: `hsl(${c.hsl})` }} 
                      aria-label={c.label} 
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">This color will be used for buttons, charts, and highlights.</p>
              </Field>
              
              <Separator className="bg-border/50" />
              
              <ToggleRow 
                label="Compact Mode" 
                desc="Use denser layouts and smaller spacing across the dashboard." 
                checked={settings.compact_mode} 
                onChange={(v) => updateSettingsAsync({ compact_mode: v })} 
              />
            </div>
          </SettingsCard>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <SettingsCard title="Notifications" description="Manage your reminders and alerts.">
            <div className="space-y-4">
              <ToggleRow label="Daily reminder" desc="A nudge to log today's trades." checked={settings.notify_daily} onChange={(v) => updateSettingsAsync({ notify_daily: v })} />
              <ToggleRow label="Weekly review" desc="Weekly AI report and reflection reminder." checked={settings.notify_weekly} onChange={(v) => updateSettingsAsync({ notify_weekly: v })} />
              <ToggleRow label="Monthly review" desc="Monthly performance recap." checked={settings.notify_monthly} onChange={(v) => updateSettingsAsync({ notify_monthly: v })} />
            </div>
          </SettingsCard>
        )}

        {/* DATA */}
        {activeTab === "data" && (
          <SettingsCard title="Data Management" description="Export your data securely to your device.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-24 flex flex-col gap-3 rounded-xl border-border bg-card hover:bg-muted transition-colors" onClick={() => exportTable("trades", "trades.csv")}>
                <Download className="h-6 w-6 text-primary" /> 
                <span className="font-medium">Export Trades</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col gap-3 rounded-xl border-border bg-card hover:bg-muted transition-colors" onClick={() => exportTable("journals", "journal.csv")}>
                <Download className="h-6 w-6 text-primary" /> 
                <span className="font-medium">Export Journal</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col gap-3 rounded-xl border-border bg-card hover:bg-muted transition-colors" onClick={() => exportTable("backtest_sessions", "backtests.csv")}>
                <Download className="h-6 w-6 text-primary" /> 
                <span className="font-medium">Export Backtests</span>
              </Button>
            </div>
            
            <div className="mt-10 border border-destructive/20 bg-destructive/5 rounded-xl p-6">
              <h4 className="text-destructive font-semibold flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4" /> Danger Zone
              </h4>
              <p className="text-sm text-muted-foreground mb-4">Deleting your data is irreversible. All your trades, journals, and backtests will be lost forever.</p>
              <Button variant="destructive" className="rounded-lg font-medium">Delete All Data</Button>
            </div>
          </SettingsCard>
        )}

        {/* SECURITY */}
        {activeTab === "security" && (
          <SettingsCard title="Security" description="Keep your account protected and manage active sessions.">
            <div className="space-y-8">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Change Password</Label>
                <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                  <Input 
                    type="password" 
                    placeholder="New password (min 8 chars)" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="bg-input border-border/60 h-11 rounded-xl"
                  />
                  <Button onClick={changePassword} className="h-11 rounded-xl bg-primary hover:bg-primary/90">
                    <KeyRound className="h-4 w-4 mr-2" /> Update
                  </Button>
                </div>
              </div>
              
              <Separator className="bg-border/50" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-5">
                <div>
                  <p className="font-semibold text-foreground">Sign out from all devices</p>
                  <p className="text-sm text-muted-foreground mt-1">Revoke every active session globally across all your devices.</p>
                </div>
                <Button variant="secondary" onClick={signOutAll} className="whitespace-nowrap rounded-xl h-10 hover:bg-destructive hover:text-destructive-foreground transition-colors border border-border/50">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out all
                </Button>
              </div>
            </div>
          </SettingsCard>
        )}

        {/* ABOUT */}
        {activeTab === "about" && (
          <SettingsCard title="About DaddyFXBook" description="System information and plan details.">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <InfoTile label="Version" value={`v${APP_VERSION}`} />
              <InfoTile label="Build Date" value={BUILD_VERSION} />
              <InfoTile label="Current Plan" value={<Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-sm">{SUBSCRIPTION}</Badge>} />
            </div>
          </SettingsCard>
        )}
        
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-input border-border/60 h-11 rounded-xl focus:ring-primary">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-card border-border rounded-xl">
        {options.map((o) => <SelectItem key={o} value={o} className="rounded-lg cursor-pointer focus:bg-muted/50 focus:text-foreground">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 p-5 hover:bg-muted/20 transition-colors">
      <div className="pr-6">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-primary shrink-0" />
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
