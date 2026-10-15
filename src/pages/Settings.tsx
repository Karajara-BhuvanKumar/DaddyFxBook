import { journalDrafts } from '@/lib/journalDrafts';
import { fetchAllAnalysisRows } from '@/lib/fetchAllAnalysisRows';
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, ChevronRight, Download, Globe2, Loader2, LogOut, Mail, Monitor, Moon, Palette, ShieldCheck, SlidersHorizontal, Sun, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings, validateAvatarFile, type UserSettings } from "@/hooks/useUserSettings";
import AccentColorPicker from "@/components/AccentColorPicker";
import { accentHex } from "@/lib/accentColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { PasswordForm } from "@/components/PasswordForm";
import { sendPasswordReset } from "@/lib/passwordReset";
import { toast } from "@/hooks/use-toast";
import "@/styles/settings.css";

const TIMEZONES = ["UTC", "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney"];
const NUMBERS = [
  { key: "account_size", label: "Account size", max: 1e12, step: "any" },
  { key: "default_risk_pct", label: "Default risk (%)", max: 100, step: "any" },
  { key: "max_daily_risk", label: "Daily risk limit (%)", max: 100, step: "any" },
  { key: "max_weekly_risk", label: "Weekly risk limit (%)", max: 100, step: "any" },
  { key: "max_trades_per_day", label: "Trades per day", max: 10000, step: "1" },
] as const;

type ExportTable = "trades" | "journals" | "backtest_sessions";

export default function Settings() {
  const { user } = useAuth();
  const { settings, isLoading, isError, refetch, updateSettingsAsync, isUpdating } = useUserSettings();
  const [draft, setDraft] = useState<Partial<UserSettings>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [accentValid, setAccentValid] = useState(true);
  const [pickerVersion, setPickerVersion] = useState(0);
  const [saveError, setSaveError] = useState('');
  const saving = useRef(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [exporting, setExporting] = useState<ExportTable | null>(null);
  const [signOutScope, setSignOutScope] = useState<"local" | "global" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const values = settings ? { ...settings, ...draft } : null;
  const dirty = Object.keys(draft).some(key => !Object.is(draft[key as keyof UserSettings], settings?.[key as keyof UserSettings])) || !!photoFile || !accentValid;
  const busy = isUpdating;

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photoFile); setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSaveError('');
    setDraft(previous => {
      const next = { ...previous };
      const unchanged = value === settings?.[key] || (key === 'accent_color' && accentHex(String(value)) === accentHex(settings?.accent_color ?? 'blue'));
      if (unchanged) delete next[key]; else next[key] = value;
      return next;
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || busy || saving.current) return;
    if (!accentValid) { setSaveError('Accent color: enter a valid HEX value, such as #3B82F6.'); return; }
    const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) => !Object.is(value, settings?.[key as keyof UserSettings]))) as Partial<UserSettings>;
    const invalidNumber = NUMBERS.find(({ key, max, step }) => key in patch && (!Number.isFinite(patch[key]) || patch[key]! < 0 || patch[key]! > max || (step === "1" && !Number.isInteger(patch[key]))));
    if (invalidNumber) {
      setSaveError(`${invalidNumber.label}: enter ${invalidNumber.step === '1' ? 'a whole number' : 'a number'} between 0 and ${invalidNumber.max.toLocaleString()}.`);
      return;
    }
    if (patch.username && !/^[a-zA-Z0-9_.]{1,30}$/.test(patch.username)) {
      setSaveError('Username: use up to 30 letters, numbers, underscores or dots.');
      return;
    }
    if (patch.display_name !== undefined) patch.display_name = patch.display_name?.trim() || null;
    if (patch.username !== undefined) patch.username = patch.username?.trim() || null;
    saving.current = true; setSaveError('');
    try {
      await updateSettingsAsync({ ...patch, ...(photoFile ? { avatarFile: photoFile } : {}) });
      resetDraft(); toast({ title: "Changes saved", description: "Your settings are up to date." });
    } catch (error) { setSaveError(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not save your settings. Please try again.'); }
    finally { saving.current = false; }
  }
  function resetDraft() {
    setDraft({}); setPhotoFile(null); setAccentValid(true); setSaveError(''); setPickerVersion(v => v + 1);
    if (fileInput.current) fileInput.current.value = '';
  }
  function changePhoto(file?: File) {
    if (!file) return;
    try { validateAvatarFile(file); setPhotoFile(file); setSaveError(''); }
    catch (error) { reportError("Couldn't select your photo", error); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  function removePhoto() { setPhotoFile(null); edit('avatar_url', null); }
  async function resetPassword() {
    if (!user?.email) return;
    setResetBusy(true);
    try { await sendPasswordReset(user.email); setResetSent(true); }
    catch (error) { reportError("Couldn't send reset email", error); }
    finally { setResetBusy(false); }
  }
  async function signOut() {
    if (!signOutScope) return;
    if ([...journalDrafts.keys()].some(key => key.startsWith(`${user?.id}:`)) && !window.confirm("You have unsaved journal changes. Sign out and discard them?")) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: signOutScope });
      if (error) throw error;
    } catch (error) { reportError("Couldn't sign out", error); }
    finally { setSigningOut(false); setSignOutScope(null); }
  }
  async function exportData(table: ExportTable) {
    if (!user) return;
    setExporting(table);
    try {
      const rows = await fetchAllAnalysisRows<Record<string, unknown> & { id: string }>(after => {
        let query = supabase.from(table).select('*').eq('user_id', user.id).order('id').limit(1000);
        if (after) query = query.gt('id', after);
        return query;
      });
      if (!rows.length) { toast({ title: "Nothing to export yet" }); return; }
      const keys = Object.keys(rows[0]);
      const cell = (value: unknown) => {
        let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
      };
      const csv = [keys.map(cell).join(","), ...rows.map(row => keys.map(key => cell(row[key])).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${table}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Export ready", description: `${rows.length} records downloaded.` });
    } catch (error) { reportError("Export failed", error); }
    finally { setExporting(null); }
  }

  if (isLoading) return <div className="settings-loading" role="status"><Loader2 className="animate-spin" /> Loading your settings…</div>;
  if (isError || !values) return <div className="settings-loading"><p>We couldn't load your settings.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>;
  const initials = (values.display_name || user?.email || "U").slice(0, 2).toUpperCase();
  const saveFooter = <>{saveError && <p role="alert" className="settings-error settings-save-error">{saveError} Your changes are still here; try saving again.</p>}<div className="settings-savebar"><span role="status">{isUpdating ? "Saving your changes…" : dirty ? "You have unsaved changes" : <><Check size={14} /> All changes saved</>}</span><div><Button type="button" variant="ghost" disabled={!dirty || busy} onClick={resetDraft}>Cancel</Button><Button type="submit" disabled={!dirty || busy}>{isUpdating && <Loader2 size={15} className="animate-spin" />}Save changes</Button></div></div></>;

  return <div className="settings-page">
    <header className="settings-header"><div><p className="settings-eyebrow">MAKE IT YOURS</p><h1>Account settings</h1><p>A few simple details. A workspace that feels like you.</p></div><span className="settings-private"><ShieldCheck size={15} /> Your personal workspace</span></header>
    <Tabs defaultValue="profile" className="settings-tabs">
      <TabsList aria-label="Account settings" className="settings-tab-list">
        <TabsTrigger value="profile"><UserRound size={17} />Profile</TabsTrigger>
        <TabsTrigger value="preferences"><SlidersHorizontal size={17} />Preferences</TabsTrigger>
        <TabsTrigger value="security"><ShieldCheck size={17} />Security</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" forceMount className="settings-tab-panel">
        <form onSubmit={save} noValidate>
          <Card title="Personal information" description="Your profile, just the way you like it." icon={<UserRound size={19} />}>
            <fieldset disabled={busy}>
              <div className="settings-photo-row">
                <Avatar className="settings-avatar"><AvatarImage src={photoPreview || values.avatar_url || undefined} alt="Your profile photo" className="object-cover" /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                <div className="settings-photo-content"><h3>Profile photo</h3><p>JPG, PNG or WebP. Up to 2 MB.</p><div className="settings-photo-actions"><input ref={fileInput} aria-label="Upload profile photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void changePhoto(e.target.files?.[0])} /><Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><Camera size={15} />Change photo</Button>{(photoFile || values.avatar_url) && <Button type="button" variant="ghost" onClick={removePhoto}>Remove</Button>}</div></div>
              </div>
              <div className="settings-card-body settings-fields">
                <Field label="Display name" id="display-name"><Input id="display-name" autoComplete="name" maxLength={80} placeholder="Your name" value={values.display_name || ""} onChange={e => edit("display_name", e.target.value)} /></Field>
                <Field label="Username" id="username" hint="Letters, numbers, underscores and dots."><Input id="username" autoComplete="username" maxLength={30} pattern="[a-zA-Z0-9_.]+" placeholder="your.username" value={values.username || ""} onChange={e => edit("username", e.target.value)} /></Field>
                <Field label="Email address" id="profile-email" hint="The email connected to your account."><div className="settings-email"><Mail size={16} /><Input id="profile-email" value={user?.email || ""} readOnly /></div></Field>
              </div>
            </fieldset>
            {saveFooter}
          </Card>
        </form>
        <section className="settings-data"><details><summary><span><Download size={17} /><span>Your data<span>Download a copy of your trading history.</span></span></span><ChevronRight size={16} /></summary><div className="settings-export-buttons">{([["trades", "Trades"], ["journals", "Journal"], ["backtest_sessions", "Backtests"]] as const).map(([table, label]) => <Button key={table} variant="outline" disabled={!!exporting} onClick={() => exportData(table)}>{exporting === table ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{exporting === table ? "Exporting…" : `Export ${label}`}</Button>)}<p className="settings-hint">CSV files, ready to open in your spreadsheet app.</p></div></details></section>
      </TabsContent>

      <TabsContent value="preferences" forceMount className="settings-tab-panel">
        <form onSubmit={save} noValidate>
          <Card title="Workspace preferences" description="Set the look and everyday defaults for your workspace." icon={<Palette size={19} />}>
            <fieldset disabled={busy} className="settings-card-body settings-preferences">
              <div><h3>Appearance</h3><p className="settings-hint">Changes stay in this form until you select Save changes.</p><div className="settings-themes">{([{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }]).map(({ value, label, icon: Icon }) => <button type="button" key={value} className={values.theme === value ? "selected" : ""} aria-pressed={values.theme === value} onClick={() => edit("theme", value)}><span className={`settings-theme-preview preview-${value}`}><i /><i /><i /></span><span><Icon size={15} />{label}{values.theme === value && <Check size={14} />}</span></button>)}</div></div>
              <AccentColorPicker key={pickerVersion} value={values.accent_color} onChange={v => edit('accent_color', v)} onValidityChange={valid => { setAccentValid(valid); setSaveError(''); }} disabled={busy} />
              <div className="settings-preference-row"><div><Label htmlFor="compact-mode">Compact layout</Label><p className="settings-hint">Smaller text and tighter spacing.</p></div><Switch id="compact-mode" checked={values.compact_mode} onCheckedChange={v => edit("compact_mode", v)} /></div>
              <div className="settings-preference-section"><h3><Globe2 size={17} />Region & time</h3><div className="settings-fields"><Field label="Timezone" id="timezone" hint="Timezone for trade dates, calendars, filters, reports, and the workspace clock."><select id="timezone" value={values.timezone} onChange={e => edit("timezone", e.target.value)}>{Array.from(new Set([...TIMEZONES, values.timezone])).map(zone => <option key={zone}>{zone}</option>)}</select></Field><Field label="Time format" id="time-format"><select id="time-format" value={values.time_format} onChange={e => edit("time_format", e.target.value)}><option value="12h">12-hour (2:30 PM)</option><option value="24h">24-hour (14:30)</option></select></Field><Field label="Default currency" id="currency" hint="Currency for your account-size default. Trade amounts are not converted."><select id="currency" value={values.currency} onChange={e => edit("currency", e.target.value)}>{Array.from(new Set(["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", values.currency])).map(currency => <option key={currency}>{currency}</option>)}</select></Field></div></div>
              <details className="settings-trading"><summary>Trading defaults <ChevronRight size={16} /></summary><p className="settings-hint">Your account and risk preferences.</p><div className="settings-fields">{NUMBERS.map(({ key, label, max, step }) => <Field key={key} label={key === "account_size" ? `${label} (${values.currency})` : label} id={key}><Input id={key} type="number" required min={0} max={max} step={step} value={Number.isNaN(values[key]) ? "" : values[key]} onChange={e => edit(key, e.target.value === "" ? NaN : Number(e.target.value))} /></Field>)}<Field label="Preferred session" id="session"><select id="session" value={values.preferred_session} onChange={e => edit("preferred_session", e.target.value)}>{["Asian", "London", "New York"].map(session => <option key={session}>{session}</option>)}</select></Field></div><Link to="/rules" className="settings-back-link">Manage your trading rules <ChevronRight size={15} /></Link></details>
            </fieldset>
            {saveFooter}
          </Card>
        </form>
      </TabsContent>

      <TabsContent value="security" forceMount className="settings-tab-panel">
        <Card title="Password & security" description="Simple ways to keep your account protected." icon={<ShieldCheck size={19} />}>
          <div className="settings-card-body"><h3 className="settings-section-title">Change password</h3><PasswordForm /></div>
          <div className="settings-security-row"><div><h3>Prefer a reset link?</h3><p>We'll email a secure link to {user?.email || "your account email"}.</p>{resetSent && <p role="status" className="settings-success">Reset email requested. Check your inbox and spam folder.</p>}</div><Button variant="outline" disabled={!user?.email || resetBusy || resetSent} onClick={resetPassword}><Mail size={15} />{resetBusy ? "Sending…" : resetSent ? "Email sent" : "Send reset link"}</Button></div>
        </Card>
        <Card title="Sign-in sessions" description="Choose where you stay signed in." icon={<Monitor size={19} />}>
          <div className="settings-security-row"><div><h3>This device</h3><p>Sign out of your current session.</p></div><Button variant="outline" onClick={() => setSignOutScope("local")}><LogOut size={15} />Sign out</Button></div>
          <div className="settings-security-row"><div><h3>All devices</h3><p>End your sessions everywhere, including this device.</p></div><Button variant="outline" className="settings-signout-all" onClick={() => setSignOutScope("global")}>Sign out everywhere</Button></div>
        </Card>
      </TabsContent>
    </Tabs>
    <p className="settings-footnote">DaddyFXBook <span>·</span> Your trading journey, your way.</p>
    <AlertDialog open={!!signOutScope} onOpenChange={open => { if (!open && !signingOut) setSignOutScope(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{signOutScope === "global" ? "Sign out on all devices?" : "Sign out of this device?"}</AlertDialogTitle><AlertDialogDescription>{dirty ? "Your unsaved settings will be lost. " : ""}You'll need to sign in again to access your workspace.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel><AlertDialogAction disabled={signingOut} onClick={e => { e.preventDefault(); void signOut(); }}>{signingOut ? "Signing out…" : "Sign out"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function reportError(title: string, error: unknown) { toast({ title, description: error && typeof error === "object" && "message" in error ? String(error.message) : "Please try again.", variant: "destructive" }); }
function Card({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return <section className="settings-card"><div className="settings-card-heading"><span className="settings-heading-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}
function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return <div className="settings-field"><Label htmlFor={id}>{label}</Label>{children}{hint && <p className="settings-hint">{hint}</p>}</div>;
}
