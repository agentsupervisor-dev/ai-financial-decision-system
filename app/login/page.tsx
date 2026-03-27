"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (session?.user?.email) {
        router.replace("/");
      }
    }
    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        router.replace("/");
      }
    });
    return () => { isMounted = false; listener?.subscription.unsubscribe(); };
  }, [router]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    // on success, onAuthStateChange fires and redirects — no need to call router here
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      <div className="w-full max-w-[400px]">
        {/* Icon + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[20px] mb-5 shadow-lg"
            style={{ background: "linear-gradient(160deg, #1d1d1f 0%, #3a3a3c 100%)" }}>
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <path d="M17 5L29 11V23L17 29L5 23V11L17 5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="17" cy="17" r="4" fill="white" fillOpacity="0.85"/>
            </svg>
          </div>
          <h1 className="text-[26px] font-semibold text-[#1d1d1f] tracking-tight">Finance Decision Machine</h1>
          <p className="mt-1.5 text-[15px] text-[#6e6e73]">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.08] p-8">
          <div className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="you@example.com" autoComplete="email"
                className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600">{error}</div>
            )}
            <button onClick={handleLogin} disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#0071e3" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#aeaeb2] mt-6">
          Multi-agent AI · Forensic · Macro · Asymmetry
        </p>
      </div>
    </div>
  );
}
