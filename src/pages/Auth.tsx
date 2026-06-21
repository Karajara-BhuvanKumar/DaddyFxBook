import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    const { error } = isLogin ? await signIn(email, password) : await signUp(email, password);
    if (error) setError(error.message);
    else if (!isLogin) setMessage("Check your email to confirm your account!");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl btn-premium flex items-center justify-center mx-auto mb-5 shadow-lg">
            <TrendingUp className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">DaddyFX Book</h1>
          <p className="text-base text-muted-foreground mt-2 font-medium">Professional XAUUSD Trading Journal</p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {isLogin ? "Welcome back" : "Create account"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="trader@example.com"
                  className="w-full bg-secondary/60 text-foreground border border-border rounded-xl pl-11 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/50" required />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-secondary/60 text-foreground border border-border rounded-xl pl-11 pr-11 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/50" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">{error}</p>}
            {message && <p className="text-sm text-profit bg-profit/10 border border-profit/20 rounded-lg px-3 py-2">{message}</p>}

            <button type="submit" disabled={loading}
              className="w-full btn-premium text-primary-foreground py-3 rounded-xl font-semibold text-base transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 group">
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />}
            </button>
          </form>

          <p className="text-base text-muted-foreground text-center mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLogin(!isLogin); setError(""); setMessage(""); }} className="text-primary hover:text-primary/80 font-medium transition-colors">
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
