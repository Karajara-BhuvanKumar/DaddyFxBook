import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Upload, Plus, Trash2, Download, LogOut, KeyRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "next-themes";

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore",
  "Asia/Dubai", "Australia/Sydney",
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];
const SESSIONS = ["Asian", "London", "New York"];
const ACCENT_COLORS: { id: string; hsl: string; label: string }[] = [
  { id: "blue", hsl: "217 91% 60%", label: "Blue" },
  { id: "purple", hsl: "262 83% 65%", label: "Purple" },
  { id: "green", hsl: "142 71% 45%", label: "Green" },
  { id: "orange", hsl: "25 95% 55%", label: "Orange" },
];

const APP_VERSION = "1.4.0";
const BUILD_VERSION = "2026.06.14";
const SUBSCRIPTION = "Elite";

type Settings = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  timezone: string;
  time_format: string;
  currency: string;
  account_size: number;
  default_risk_pct: number;
  max_daily_risk: number;
  max_weekly_risk: number;
  max_trades_per_day: number;
  preferred_session: string;
  theme: string;
  accent_color: string;
  chart_style: string;
  compact_mode: boolean;
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_monthly: boolean;
};

type Rule = { id: string; rule: string; active: boolean; position: number };

const DEFAULTS = (uid: string): Settings => ({
  user_id: uid,
  display_name: null,
  username: null,
  avatar_url: null,
  timezone: "UTC",
  time_format: "24h",
  currency: "USD",
  account_size: 10000,
  default_risk_pct: 1,
  max_daily_risk: 3,
  max_weekly_risk: 6,
  max_trades_per_day: 3,
  preferred_session: "London",
  theme: "dark",
  accent_color: "blue",
  chart_style: "smooth",
  compact_mode: false,
  notify_daily: true,
  notify_weekly: true,
  notify_monthly: false,
});

function applyAppearance(theme: string, accent: string, compact: boolean) {
  const root = document.documentElement;
  if (theme === "light") root.classList.remove("dark");
  else if (theme === "dark") root.classList.add("dark");
  else {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  }
  const accentDef = ACCENT_COLORS.find((c) => c.id === accent) ?? ACCENT_COLORS[0];
  root.style.setProperty("--primary", accentDef.hsl);
  root.style.setProperty("--ring", accentDef.hsl);
  root.style.setProperty("--sidebar-primary", accentDef.hsl);
  root.style.setProperty("--sidebar-accent", accentDef.hsl);
  root.style.fontSize = compact ? "13px" : "14px";
}

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
  const fileInput = useRef<HTMLInputElement>(null);
  const [newRule, setNewRule] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["user_settings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      if (!data) {
        const def = DEFAULTS(uid);
        const { error: insErr } = await supabase.from("user_settings").insert(def);
        if (insErr) throw insErr;
        return def;
      }
      return data as Settings;
    },
  });

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

  const { setTheme } = useTheme();
  const [local, setLocal] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setLocal(settings); }, [settings]);
  useEffect(() => {
    if (local) {
      applyAppearance(local.theme, local.accent_color, local.compact_mode);
      setTheme(local.theme);
    }
  }, [local?.theme, local?.accent_color, local?.compact_mode, setTheme]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await supabase.from("user_settings").update(patch).eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_settings", uid] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const update = (patch: Partial<Settings>) => setLocal((s) => (s ? { ...s, ...patch } : s));
  const saveAll = () => { if (local) saveMutation.mutate(local); };

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

  const onAvatarSelected = async (file: File) => {
    if (!uid) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? null;
    update({ avatar_url: url });
    await supabase.from("user_settings").update({ avatar_url: url }).eq("user_id", uid);
    qc.invalidateQueries({ queryKey: ["user_settings", uid] });
    toast({ title: "Avatar updated" });
  };

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

  if (!local) {
    return <div className="text-muted-foreground py-20 text-center">Loading settings…</div>;
  }

  const initials = (local.display_name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your trading workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button onClick={saveAll} disabled={saveMutation.isPending} className="btn-premium text-primary-foreground">
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-9 h-auto gap-1 bg-card/40 p-1 border border-border">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="trading" className="gap-2"><SettingsIcon className="h-4 w-4" />Trading</TabsTrigger>
          <TabsTrigger value="rules" className="gap-2"><ShieldCheck className="h-4 w-4" />Rules</TabsTrigger>
          <TabsTrigger value="time" className="gap-2"><Clock className="h-4 w-4" />Time</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2"><Palette className="h-4 w-4" />Appearance</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notify</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><Database className="h-4 w-4" />Data</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="about" className="gap-2"><Info className="h-4 w-4" />About</TabsTrigger>
        </TabsList>

        {/* PROFILE */}
        <TabsContent value="profile" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your identity across DaddyFXBook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 ring-2 ring-primary/30">
                  <AvatarImage src={local.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={fileInput} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && onAvatarSelected(e.target.files[0])}
                  />
                  <Button variant="outline" onClick={() => fileInput.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload picture
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG or JPG. Max 2MB recommended.</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Display name">
                  <Input value={local.display_name ?? ""} onChange={(e) => update({ display_name: e.target.value })} placeholder="Your name" />
                </Field>
                <Field label="Username">
                  <Input value={local.username ?? ""} onChange={(e) => update({ username: e.target.value })} placeholder="@handle" />
                </Field>
                <Field label="Email (read-only)">
                  <Input value={user?.email ?? ""} disabled />
                </Field>
                <Field label="Timezone">
                  <SelectInput value={local.timezone} onChange={(v) => update({ timezone: v })} options={TIMEZONES} />
                </Field>
                <Field label="Time format">
                  <SelectInput value={local.time_format} onChange={(v) => update({ time_format: v })} options={["12h", "24h"]} />
                </Field>
                <Field label="Default currency">
                  <SelectInput value={local.currency} onChange={(v) => update({ currency: v })} options={CURRENCIES} />
                </Field>
                <Field label="Account size">
                  <Input type="number" value={local.account_size} onChange={(e) => update({ account_size: Number(e.target.value) })} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRADING PREFERENCES */}
        <TabsContent value="trading" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Trading Preferences</CardTitle>
              <CardDescription>Define risk envelope and execution defaults.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Default risk %">
                <Input type="number" step="0.1" value={local.default_risk_pct}
                  onChange={(e) => update({ default_risk_pct: Number(e.target.value) })} />
              </Field>
              <Field label="Max daily risk (%)">
                <Input type="number" step="0.1" value={local.max_daily_risk}
                  onChange={(e) => update({ max_daily_risk: Number(e.target.value) })} />
              </Field>
              <Field label="Max weekly risk (%)">
                <Input type="number" step="0.1" value={local.max_weekly_risk}
                  onChange={(e) => update({ max_weekly_risk: Number(e.target.value) })} />
              </Field>
              <Field label="Max trades / day">
                <Input type="number" value={local.max_trades_per_day}
                  onChange={(e) => update({ max_trades_per_day: Number(e.target.value) })} />
              </Field>
              <Field label="Preferred session">
                <SelectInput value={local.preferred_session} onChange={(v) => update({ preferred_session: v })} options={SESSIONS} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RULES */}
        <TabsContent value="rules" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Trading Rules</CardTitle>
              <CardDescription>Your personal commandments. AI reports check trades against active rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="e.g. Minimum RR = 2" value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newRule.trim() && addRule.mutate(newRule.trim())} />
                <Button onClick={() => newRule.trim() && addRule.mutate(newRule.trim())}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {rules.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No rules yet. Add your first one above.</p>
                )}
                {rules.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <Switch checked={r.active} onCheckedChange={(v) => updateRule.mutate({ id: r.id, patch: { active: v } })} />
                    <Input
                      defaultValue={r.rule}
                      onBlur={(e) => e.target.value !== r.rule && updateRule.mutate({ id: r.id, patch: { rule: e.target.value } })}
                      className="bg-transparent border-0 focus-visible:ring-0 px-0"
                    />
                    <Button size="icon" variant="ghost" onClick={() => deleteRule.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIME */}
        <TabsContent value="time" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Time Settings</CardTitle>
              <CardDescription>All trades are stored in UTC. Display follows your timezone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-label">UTC</p>
                  <p className="text-num text-lg mt-1">{utcNow}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-label">IST (Asia/Kolkata)</p>
                  <p className="text-num text-lg mt-1">{istNow}</p>
                </div>
              </div>
              <Field label="Your timezone">
                <SelectInput value={local.timezone} onChange={(v) => update({ timezone: v })} options={TIMEZONES} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPEARANCE */}
        <TabsContent value="appearance" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Personalize the interface.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Field label="Theme">
                <div className="flex gap-2">
                  {["dark", "light", "system"].map((t) => (
                    <Button key={t} variant={local.theme === t ? "default" : "outline"}
                      onClick={() => update({ theme: t })} className="capitalize">{t}</Button>
                  ))}
                </div>
              </Field>
              <Field label="Accent color">
                <div className="flex gap-3">
                  {ACCENT_COLORS.map((c) => (
                    <button key={c.id} onClick={() => update({ accent_color: c.id })}
                      className={`h-10 w-10 rounded-full ring-2 transition ${local.accent_color === c.id ? "ring-foreground scale-110" : "ring-transparent"}`}
                      style={{ background: `hsl(${c.hsl})` }} aria-label={c.label} />
                  ))}
                </div>
              </Field>
              <Field label="Chart style">
                <div className="flex gap-2">
                  {["smooth", "sharp"].map((t) => (
                    <Button key={t} variant={local.chart_style === t ? "default" : "outline"}
                      onClick={() => update({ chart_style: t })} className="capitalize">{t}</Button>
                  ))}
                </div>
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="font-medium">Compact mode</p>
                  <p className="text-sm text-muted-foreground">Denser layouts and smaller spacing.</p>
                </div>
                <Switch checked={local.compact_mode} onCheckedChange={(v) => update({ compact_mode: v })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Reminders and warnings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow label="Daily reminder" desc="A nudge to log today's trades." checked={local.notify_daily} onChange={(v) => update({ notify_daily: v })} />
              <ToggleRow label="Weekly review" desc="Weekly AI report and reflection." checked={local.notify_weekly} onChange={(v) => update({ notify_weekly: v })} />
              <ToggleRow label="Monthly review" desc="Monthly performance recap." checked={local.notify_monthly} onChange={(v) => update({ notify_monthly: v })} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DATA */}
        <TabsContent value="data" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Export your data as CSV anytime.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button variant="outline" onClick={() => exportTable("trades", "trades.csv")}>
                <Download className="h-4 w-4" /> Export trades
              </Button>
              <Button variant="outline" onClick={() => exportTable("journals", "journal.csv")}>
                <Download className="h-4 w-4" /> Export journal
              </Button>
              <Button variant="outline" onClick={() => exportTable("backtest_sessions", "backtests.csv")}>
                <Download className="h-4 w-4" /> Export backtests
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Keep your account protected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Change password</Label>
                <div className="flex gap-2">
                  <Input type="password" placeholder="New password (min 8 chars)" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} />
                  <Button onClick={changePassword}><KeyRound className="h-4 w-4" /> Update</Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sign out from all devices</p>
                  <p className="text-sm text-muted-foreground">Revoke every active session globally.</p>
                </div>
                <Button variant="destructive" onClick={signOutAll}><LogOut className="h-4 w-4" /> Sign out all</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABOUT */}
        <TabsContent value="about" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Build details and subscription.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InfoTile label="App version" value={APP_VERSION} />
              <InfoTile label="Build" value={BUILD_VERSION} />
              <InfoTile label="Plan" value={<Badge className="bg-primary/20 text-primary border-primary/30">{SUBSCRIPTION}</Badge>} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-label">{label}</Label>
      {children}
    </div>
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-label">{label}</p>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
