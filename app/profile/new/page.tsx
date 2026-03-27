"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>({
    name: "", investment_period: "3yr",
    inflation: 3.5, borrowing: 7.5, index_return: 12.0, opex: 0.5, alpha_target: 6.5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalHurdle = form.inflation + form.borrowing + form.index_return + form.opex + form.alpha_target;

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to create profile"); } else { router.push("/profile"); }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/profile")} className="text-[#0071e3] text-[13px] hover:underline">← Profiles</button>
          <span className="text-[13px] font-medium text-[#1d1d1f]">New Profile</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-[32px] font-semibold text-[#1d1d1f] tracking-tight mb-8">New Investment Profile</h1>

        {/* Profile Name */}
        <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 mb-5">
          <label className="block text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest mb-3">Profile Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Buying a Car, Child Education, Retirement…"
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
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-widest">Hurdle Rate Components</h2>
            <span className="text-[22px] font-semibold" style={{ color: "#0071e3" }}>{totalHurdle.toFixed(1)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {([
              ["inflation",    "Inflation (%)"],
              ["borrowing",    "Borrowing Cost (%)"],
              ["index_return", "Index Return (%)"],
              ["opex",         "OpEx (%)"],
              ["alpha_target", "Alpha Target (%)"],
            ] as [keyof ProfileForm, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-[12px] text-[#6e6e73] mb-1.5">{label}</label>
                <input type="number" step="0.1" value={form[key] as number}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2.5 text-[15px] text-[#1d1d1f] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{error}</div>
        )}

        <button onClick={handleCreate} disabled={saving || !form.name.trim()}
          className="w-full py-3.5 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#0071e3" }}>
          {saving ? "Creating…" : "Create Profile"}
        </button>
      </div>
    </div>
  );
}
