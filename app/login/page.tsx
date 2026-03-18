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
  const [info, setInfo] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setUserEmail(session?.user?.email ?? null);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
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
    setInfo(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      setInfo("Logged in successfully.");
      router.push("/");
    }

    setLoading(false);
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
    } else {
      setInfo("You have been signed out.");
      setEmail("");
      setPassword("");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Login
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          Sign in with your Supabase account to access personalized activity.
        </p>

        {isLoggedIn ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
              <p className="text-sm text-zinc-400 mb-2">Signed in as</p>
              <p className="font-mono text-white break-all">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing out…" : "Sign out"}
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full px-4 py-3 border border-zinc-700 text-zinc-200 rounded-lg hover:border-zinc-500 transition-colors"
            >
              Return to dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs text-zinc-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-500"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-600/20 border border-red-500 p-3 text-sm text-red-100">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-lg bg-emerald-500/20 border border-emerald-400 p-3 text-sm text-emerald-100">
                {info}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <button
              onClick={() => router.push("/")}
              className="w-full px-4 py-3 border border-zinc-700 text-zinc-200 rounded-lg hover:border-zinc-500 transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
