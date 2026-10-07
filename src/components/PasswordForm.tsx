import { useId, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setSuccess(false);
    if (password.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (password !== confirm) { setError("Your passwords don't match. Please try again."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirm(""); setSuccess(true); onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't update your password. Please try again.");
    } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="settings-password-form">
    <fieldset disabled={busy} className="settings-fields">
      <div className="settings-field">
        <Label htmlFor={`${id}-password`}>New password</Label>
        <div className="settings-password-input">
          <Input id={`${id}-password`} type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={e => { setPassword(e.target.value); setSuccess(false); }} aria-describedby={`${id}-hint`} />
          <button type="button" aria-label={visible ? "Hide passwords" : "Show passwords"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
        </div>
        <p id={`${id}-hint`} className="settings-hint">At least 8 characters. Make it unique.</p>
      </div>
      <div className="settings-field">
        <Label htmlFor={`${id}-confirm`}>Confirm new password</Label>
        <Input id={`${id}-confirm`} type={visible ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>
    </fieldset>
    {error && <p role="alert" className="settings-error">{error}</p>}
    {success && <p role="status" className="settings-success">Your password has been updated.</p>}
    <Button type="submit" disabled={busy || !password || !confirm}>{busy ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}{busy ? "Updating…" : "Update password"}</Button>
  </form>;
}
