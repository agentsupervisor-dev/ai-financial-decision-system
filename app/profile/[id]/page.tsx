"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InvestmentPeriod = "1yr" | "3yr" | "5yr";

interface ProfileForm {
  name: string;
  investment_period: InvestmentPeriod;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

const PERIOD_LABELS: Record<InvestmentPeriod, { short: string; long: string }> = {
  "1yr": { short: "1 Year",   long: "Short-term" },
  "3yr": { short: "3 Years",  long: "Medium-term" },
  "5yr": { short: "5+ Years", long: "Long-term" },
};

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

export default function EditProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<ProfileForm>({
    name: "", investment_period: "3yr",
    inflation: 3.5, borrowing: 7.5, index_return: 12.0, opex: 0.5, alpha_target: 6.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      const profile = (json.profiles ?? []).find((p: { id: number }) => String(p.id) === id);
      if (profile) {
        setForm({
          name: profile.name,
          investment_period: profile.investment_period,
          inflation: profile.inflation,
          borrowing: profile.borrowing,
          index_return: profile.index_return,
          opex: profile.opex,
          alpha_target: profile.alpha_target,
        });
      }
      setLoading(false);
    }
    load();
  }, [router, id]);

  const totalHurdle = form.inflation + form.borrowing + form.index_return + form.opex + form.alpha_target;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch(`/api/profile/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to save"); } else { router.push("/profile"); }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={APPLE}>
        <p className="text-[#6e6e73] text-[15px]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/profile")} className="text-[#0071e3] text-[13px] hover:underline">← Profiles</button>
          <span className="text-[13px] font-medium text-[#1d1d1f]">Edit Profile</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
        <h1 className="text-[32px] font-semibold text-[#1d1d1f] tracking-tight mb-8">Edit Profile</h1>

        {/* Profile Name */}
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-5">
          <label className="block text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest mb-3">Profile Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Buying a Car, Child Education…"
            className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-3 text-[17px] text-[#1d1d1f] placeholder-[#aeaeb2] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all"
          />
        </div>

        {/* Investment Period */}
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-5">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest mb-4">Investment Time Period</h2>
          <div className="grid grid-cols-3 gap-3">
            {(["1yr", "3yr", "5yr"] as InvestmentPeriod[]).map((p) => (
              <button key={p} onClick={() => setForm((f) => ({ ...f, investment_period: p }))}
                className="rounded-xl border py-5 text-center transition-all"
                style={{ borderColor: form.investment_period === p ? "#0071e3" : "#d2d2d7", background: form.investment_period === p ? "#e8f0fe" : "#f5f5f7" }}>
                <div className="text-[20px] font-semibold" style={{ color: form.investment_period === p ? "#0071e3" : "#1d1d1f" }}>
                  {PERIOD_LABELS[p].short}
                </div>
                <div className="text-[12px] mt-1" style={{ color: form.investment_period === p ? "#0071e3" : "#6e6e73" }}>
                  {PERIOD_LABELS[p].long}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Hurdle Rate */}
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-5">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest">Hurdle Rate Components</h2>
            <span className="text-[28px] font-bold" style={{ color: "#0071e3" }}>{totalHurdle.toFixed(1)}%</span>
          </div>
          <div className="space-y-5">
            {([
              ["inflation",    "Inflation Rate",   "Expected annual inflation",   15 ],
              ["borrowing",    "Borrowing Cost",   "Cost of capital / loan rate", 25 ],
              ["index_return", "Index Return",     "Expected S&P 500 return",     25 ],
              ["opex",         "OpEx / Fees",      "Management fees / expenses",  5  ],
              ["alpha_target", "Alpha Target",     "Extra return above market",   20 ],
            ] as [keyof ProfileForm, string, string, number][]).map(([key, label, hint, max]) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-36 shrink-0">
                  <p className="text-[13px] text-[#1d1d1f] font-medium leading-tight">{label}</p>
                  <p className="text-[10px] text-[#aeaeb2] mt-0.5">{hint}</p>
                </div>
                <div className="flex-1">
                  <input
                    type="range" min={0} max={max} step={0.5}
                    value={form[key] as number}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) }))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: "#0071e3" }}
                  />
                  <div className="flex justify-between text-[9px] text-[#aeaeb2] mt-0.5 px-0.5">
                    <span>0%</span><span>{max}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" step={0.5} min={0} max={max}
                    value={form[key] as number}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: Math.min(max, parseFloat(e.target.value) || 0) }))}
                    className="w-16 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-2 py-1.5 text-[14px] text-right font-semibold focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
                  <span className="text-[13px] text-[#6e6e73]">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{error}</div>
        )}

        <button onClick={handleSave} disabled={saving || !form.name.trim()}
          className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#0071e3" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
