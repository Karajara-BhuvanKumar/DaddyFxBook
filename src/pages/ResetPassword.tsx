import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PasswordForm } from "@/components/PasswordForm";
import { sendPasswordReset } from "@/lib/passwordReset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "@/styles/settings.css";

export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("error_description") || "");
  async function requestReset(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await sendPasswordReset(email.trim()); setSent(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn't send the reset email. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="settings-page settings-recovery">
    <section className="settings-card">
      <div className="settings-card-heading"><span className="settings-heading-icon"><ShieldCheck size={21} /></span><div><h1>{done ? "You're all set" : "Reset your password"}</h1><p>{done ? "Your new password is ready to use." : "A fresh start for your account."}</p></div></div>
      <div className="settings-card-body">
        {loading ? <p role="status">Checking your reset link…</p> : done ? <Button asChild><Link to="/settings">Back to settings</Link></Button> : user && !error ? <PasswordForm onSuccess={() => setDone(true)} /> : <form onSubmit={requestReset} className="space-y-4">
          <p className="settings-hint">Enter your account email and we'll send you a link to choose a new password.</p>
          <div className="settings-field"><Label htmlFor="reset-email">Email address</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => { setEmail(e.target.value); setSent(false); }} /></div>
          {error && <p role="alert" className="settings-error">{error}</p>}
          {sent && <p role="status" className="settings-success">If an account exists for this email, you'll receive a reset link. Check your inbox and spam folder.</p>}
          <Button type="submit" disabled={busy || sent}>{busy ? "Sending…" : sent ? "Reset link requested" : "Send reset link"}</Button>
        </form>}
        <Link className="settings-back-link" to="/auth"><ArrowLeft size={15} /> Back to sign in</Link>
      </div>
    </section>
  </main>;
}
