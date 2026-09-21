"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

// Swap this URL to change the background video — nothing else needs to change.
const BACKGROUND_VIDEO_URL =
  "https://ik.imagekit.io/6kafqkidx/14470768_2160_3840_30fps.mp4";

export function AuthCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  function switchMode(next: Mode) {
    resetMessages();
    setMode(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!supabase) return;
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!supabase) return;
    if (!fullName || !email || !password) {
      setError("Fill in your name, email, and password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreed) {
      setError("You need to agree to the Terms & Conditions first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Account created — check your email to confirm it, then sign in.");
    setMode("login");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (!supabase) return;
    if (!email) {
      setError("Enter the email on your account.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Password reset link sent — check your inbox.");
  }

  return (
    <div className="sct-auth-root relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050b14] px-4 py-10">
      {/* ---------- Looping background video ---------- */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src={BACKGROUND_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050b14]/75 via-[#050b14]/45 to-[#050b14]/80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,6,12,0.55)_100%)]" />

      {/* ---------- Brand mark ---------- */}
      <div className="absolute left-6 top-6 z-10 flex items-center gap-2.5 sm:left-8 sm:top-8">
        <img
          src="https://ik.imagekit.io/6kafqkidx/logome.png"
          alt="Kingdom Trading Logistics"
          className="h-8 w-8 rounded-md object-contain"
        />
        <span className="text-[15px] font-semibold text-white">Kingdom Trading Logistics</span>
      </div>

      {/* ---------- Auth card ---------- */}
      <div className="relative z-10 w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#0a1420]/80 p-7 shadow-2xl backdrop-blur-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#222b9c]/20">
            <Anchor className="h-5 w-5 text-[#5865f2]" />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5865f2]">
            Shipment Control Tower
          </div>
          <h1 className="mt-1.5 text-[22px] font-semibold text-white">
            {mode === "login" && "Welcome back"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
          </h1>
          <p className="mt-1 text-[13px] text-slate-400">
            {mode === "login" && "Sign in to track every container in real time."}
            {mode === "signup" && "Set up access for your logistics team."}
            {mode === "forgot" && "We'll email you a link to get back in."}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning-soft/10 px-3 py-2.5 text-[12.5px] text-amber-300">
            Supabase isn&apos;t connected yet — add your project keys to{" "}
            <code className="text-amber-200">.env.local</code> to enable sign-in.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12.5px] text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-[12.5px] text-emerald-300">
            {notice}
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-[12.5px]">
              <label className="flex items-center gap-1.5 text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-slate-400 hover:text-white"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#222b9c] py-2.5 text-[13.5px] font-medium text-white hover:bg-[#2b3bb6] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>

            <p className="pt-1 text-center text-[12.5px] text-slate-400">
              New to Kingdom Trading Logistics?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-medium text-white hover:underline"
              >
                Create an account
              </button>
            </p>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-3.5">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
            </div>

            <label className="flex items-start gap-2 text-[12.5px] text-slate-400">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-transparent"
              />
              I agree with the Terms &amp; Conditions
            </label>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#222b9c] py-2.5 text-[13.5px] font-medium text-white hover:bg-[#2b3bb6] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </button>

            <p className="pt-1 text-center text-[12.5px] text-slate-400">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-white hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-3.5">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isSupabaseConfigured}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-[13.5px] text-white placeholder:text-slate-500 focus:border-[#5865f2] focus:outline-none disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#222b9c] py-2.5 text-[13.5px] font-medium text-white hover:bg-[#2b3bb6] disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>

            <p className="pt-1 text-center text-[12.5px] text-slate-400">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-white hover:underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}