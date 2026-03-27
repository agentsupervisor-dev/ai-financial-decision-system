"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InvestmentPeriod = "1yr" | "3yr" | "5yr";

interface ProfileForm {
  investment_period: InvestmentPeriod;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

const PERIOD_LABELS: Record<InvestmentPeriod, string> = {
  "1yr": "Short-term (1 year)",
  "3yr": "Medium-term (3 years)",
  "5yr": "Long-term (5+ years)",
};

const defaults: ProfileForm = {
  investment_period: "3yr",
  inflation: 3.5,
  borrowing: 7.5,
  index_return: 12.0,
  opex: 0.5,
  alpha_target: 6.5,
};

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);

      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.profile) {
        setForm({
          investment_period: json.profile.investment_period,
          inflation: json.profile.inflation,
          borrowing: json.profile.borrowing,
          index_return: json.profile.index_return,
          opex: json.profile.opex,
          alpha_target: json.profile.alpha_target,
        });
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const totalHurdle = form.inflation + form.borrowing + form.index_return + form.opex + form.alpha_target;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to save profile");
    } else {
      router.push("/");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <span className="text-zinc-500 text-sm animate-pulse">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white">Investment Profile</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Signed in as <span className="text-zinc-300 font-mono">{userEmail}</span>
          </p>
        </div>

        {/* Investment Period */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Investment Time Period
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(["1yr", "3yr", "5yr"] as InvestmentPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setForm((f) => ({ ...f, investment_period: p }))}
                className={`rounded-xl border px-4 py-4 text-center transition-colors ${
                  form.investment_period === p
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <div className="font-bold text-lg font-mono">{p}</div>
                <div className="text-xs mt-1 leading-tight">{PERIOD_LABELS[p].split(" ").slice(0, 1)}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{PERIOD_LABELS[form.investment_period]}</p>
        </div>

        {/* Hurdle Rate */}
        <div className="mb-8">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Hurdle Rate Components
            </h2>
            <span className="font-mono text-emerald-400 font-bold text-sm">{totalHurdle.toFixed(1)}% total</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 grid grid-cols-2 gap-4">
            {(
              [
                ["inflation", "Inflation (%)"],
                ["borrowing", "Borrowing Cost (%)"],
                ["index_return", "Index Return (%)"],
                ["opex", "OpEx (%)"],
                ["alpha_target", "Alpha Target (%)"],
              ] as [keyof ProfileForm, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-zinc-500 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={form[key] as number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/40 border border-red-800/40 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save & Go to Dashboard"}
        </button>
      </div>
    </div>
  );
}
