"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setUserEmail(session?.user?.email ?? null);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const isLoggedIn = useMemo(() => Boolean(userEmail), [userEmail]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push("/");
    }
    setLoading(false);
  }

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setUserEmail(null);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* Top nav bar */}
      <nav className="w-full bg-[rgba(245,245,247,0.85)] backdrop-blur-md border-b border-black/5 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <span className="text-sm font-medium text-[#1d1d1f]">Finance Decision Machine</span>
        <span className="text-xs text-[#6e6e73]">Intelligent Market Analysis</span>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[440px]">

          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-[22px] mb-6 shadow-lg"
              style={{ background: "linear-gradient(145deg, #1d1d1f 0%, #3a3a3c 100%)" }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 6L30 12V24L18 30L6 24V12L18 6Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                <circle cx="18" cy="18" r="4" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">
              {isLoggedIn ? "You're signed in" : "Sign in"}
            </h1>
            <p className="mt-2 text-[15px] text-[#6e6e73]">
              {isLoggedIn ? "Manage your session below" : "Access your investment profile and market scan"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] overflow-hidden">
            {isLoggedIn ? (
              <div className="p-8 space-y-3">
                <div className="bg-[#f5f5f7] rounded-xl px-5 py-4">
                  <p className="text-xs text-[#6e6e73] mb-1">Signed in as</p>
                  <p className="text-sm font-medium text-[#1d1d1f] break-all">{userEmail}</p>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: "#0071e3" }}
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-medium text-[#0071e3] bg-[#f5f5f7] hover:bg-[#ebebed] transition-colors disabled:opacity-40"
                >
                  {loading ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : (
              <div className="p-8">
                <div className="space-y-5">
                  {/* Email */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3.5 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3.5 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600">
                      {error}
                    </div>
                  )}

                  {/* Sign in */}
                  <button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                    style={{ background: loading || !email || !password ? "#aeaeb2" : "#0071e3" }}
                  >
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-[12px] text-[#aeaeb2] mt-6 leading-relaxed">
            Your data is private and protected.<br />Multi-agent AI · Forensic · Macro · Asymmetry
          </p>
        </div>
      </div>

      {/* Bottom footer */}
      <footer className="py-6 border-t border-black/5 text-center">
        <p className="text-[12px] text-[#aeaeb2]">Copyright © 2025 Finance Decision Machine. All rights reserved.</p>
      </footer>
    </div>
  );
}
