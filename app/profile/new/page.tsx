"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useScan } from "@/lib/ScanContext";

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

const MARKET_CAP_PRESETS = [
  { key: "mega10",    label: "MEGA Cap",    sublabel: "Top 10",  count: 10, color: "#0071e3", bg: "#f0f6ff", description: "Apple, Microsoft, NVIDIA, Alphabet, Amazon + 5 more" },
  { key: "nasdaq100", label: "NASDAQ 100",  sublabel: "Top 25",  count: 25, color: "#5856d6", bg: "#f3f2ff", description: "Top NASDAQ-listed tech & growth companies" },
  { key: "sp500",     label: "S&P 500",     sublabel: "Top 30",  count: 30, color: "#34c759", bg: "#f0fdf4", description: "Largest US companies across all sectors" },
];

const SECTOR_PRESETS = [
  { key: "sector_tech",       label: "Technology",  icon: "💻", count: 15, description: "NVIDIA, AMD, Qualcomm, Oracle and more" },
  { key: "sector_health",     label: "Healthcare",  icon: "🏥", count: 13, description: "Eli Lilly, UnitedHealth, J&J and more" },
  { key: "sector_finance",    label: "Financial",   icon: "🏦", count: 12, description: "JPMorgan, Visa, Mastercard and more" },
  { key: "sector_energy",     label: "Energy",      icon: "⚡", count: 8,  description: "Exxon, Chevron, ConocoPhillips and more" },
  { key: "sector_consumer",   label: "Consumer",    icon: "🛍️", count: 12, description: "Amazon, Walmart, McDonald's and more" },
  { key: "sector_industrial", label: "Industrial",  icon: "🏭", count: 11, description: "Honeywell, Union Pacific, Caterpillar and more" },
];

const PERIOD_OPTIONS = [
  { value: "1yr", label: "Short-term · 1 yr" },
  { value: "3yr", label: "Medium-term · 3 yrs" },
  { value: "5yr", label: "Long-term · 5+ yrs" },
];

const ALL_PRESETS = [...MARKET_CAP_PRESETS, ...SECTOR_PRESETS];

export default function NewProfilePage() {
  const router = useRouter();
  const { refreshProfiles } = useScan();

  const [step, setStep] = useState<1 | 2>(1);
  const [universeType, setUniverseType] = useState<"preset" | "manual">("preset");
  const [universeKey, setUniverseKey] = useState<string>("");

  const [name, setName] = useState("");
  const [period, setPeriod] = useState("3yr");
  const [inflation, setInflation] = useState(3.5);
  const [borrowing, setBorrowing] = useState(7.5);
  const [indexReturn, setIndexReturn] = useState(12.0);
  const [opex, setOpex] = useState(0.5);
  const [alpha, setAlpha] = useState(6.5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hurdle = inflation + borrowing + indexReturn + opex + alpha;
  const selectedPreset = ALL_PRESETS.find((p) => p.key === universeKey);

  function handleSelectUniverse(key: string) {
    setUniverseKey(key);
    setUniverseType("preset");
  }

  function goToStep2() {
    if (!universeKey) { setError("Please select a stock universe."); return; }
    setError(null);
    if (!name && selectedPreset) setName(selectedPreset.label);
    setStep(2);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Profile name is required."); return; }
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        name: name.trim(), investment_period: period,
        inflation, borrowing, index_return: indexReturn,
        opex, alpha_target: alpha,
        universe_type: universeType,
        universe_key: universeKey || "manual",
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Save failed."); setSaving(false); return; }
    await refreshProfiles();
    router.push("/market");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={APPLE}>
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => step === 2 ? setStep(1) : router.push("/market")}
            className="text-[13px] text-[#0071e3] hover:underline">
            ← {step === 2 ? "Back" : "Cancel"}
          </button>
          <span className="text-[13px] font-medium text-[#1d1d1f]">New Profile — Step {step} of 2</span>
          <div className="flex gap-1.5">
            {[1, 2].map((s) => (
              <div key={s} className="w-2 h-2 rounded-full transition-colors"
                style={{ background: step >= s ? "#0071e3" : "#d2d2d7" }} />
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 pb-24">

        {/* STEP 1 — Universe Picker */}
        {step === 1 && (
          <div>
            <h1 className="text-[32px] font-semibold text-[#1d1d1f] tracking-tight mb-1">What do you want to scan?</h1>
            <p className="text-[15px] text-[#6e6e73] mb-8">Choose a stock universe. You can create multiple profiles with different universes.</p>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{error}</div>}

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">By Market Cap</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {MARKET_CAP_PRESETS.map((p) => (
                <button key={p.key} onClick={() => handleSelectUniverse(p.key)}
                  className="text-left rounded-2xl border-2 p-5 transition-all"
                  style={{ borderColor: universeKey === p.key ? p.color : "#e5e5ea", background: universeKey === p.key ? p.bg : "#fff" }}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[17px] font-semibold" style={{ color: p.color }}>{p.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.color }}>{p.count} stocks</span>
                  </div>
                  <p className="text-[12px] font-medium text-[#6e6e73] mb-0.5">{p.sublabel}</p>
                  <p className="text-[11px] text-[#aeaeb2] leading-relaxed">{p.description}</p>
                </button>
              ))}
            </div>

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">By Sector</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {SECTOR_PRESETS.map((p) => (
                <button key={p.key} onClick={() => handleSelectUniverse(p.key)}
                  className="text-left rounded-2xl border-2 p-4 transition-all"
                  style={{ borderColor: universeKey === p.key ? "#0071e3" : "#e5e5ea", background: universeKey === p.key ? "#f0f6ff" : "#fff" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[18px]">{p.icon}</span>
                    <span className="text-[14px] font-semibold text-[#1d1d1f]">{p.label}</span>
                  </div>
                  <p className="text-[11px] text-[#aeaeb2] mb-1.5 leading-relaxed">{p.description}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f5f5f7] text-[#6e6e73]">{p.count} stocks</span>
                </button>
              ))}
            </div>

            <p className="text-[12px] font-semibold text-[#aeaeb2] uppercase tracking-wide mb-3">Manual Picks</p>
            <button onClick={() => { setUniverseType("manual"); setUniverseKey("manual"); }}
              className="w-full text-left rounded-2xl border-2 p-5 transition-all"
              style={{ borderColor: universeKey === "manual" ? "#0071e3" : "#e5e5ea", background: universeKey === "manual" ? "#f0f6ff" : "#fff" }}>
              <div className="flex items-center gap-3">
                <span className="text-[24px]">🔍</span>
                <div>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">Pick Stocks Manually</p>
                  <p className="text-[12px] text-[#aeaeb2] mt-0.5">Search and add any stocks after creating the profile</p>
                </div>
              </div>
            </button>

            <div className="flex justify-end mt-8">
              <button onClick={goToStep2} disabled={!universeKey}
                className="px-8 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                style={{ background: "#0071e3" }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Hurdle Rate */}
        {step === 2 && (
          <div>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3" style={{ background: "#f0f6ff" }}>
                <span className="text-[13px] font-medium text-[#0071e3]">
                  {selectedPreset ? `${selectedPreset.label} · ${selectedPreset.count} stocks` : "Manual Picks"}
                </span>
              </div>
              <h1 className="text-[32px] font-semibold text-[#1d1d1f] tracking-tight mb-1">Set your hurdle rate</h1>
              <p className="text-[15px] text-[#6e6e73]">The minimum annual return you need to justify investing.</p>
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600 mb-5">{error}</div>}

            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 space-y-5">
              <div>
                <label className="text-[13px] font-medium text-[#1d1d1f] block mb-2">Profile Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={selectedPreset?.label ?? "My Portfolio"}
                  className="w-full rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-4 py-2.5 text-[15px] focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#1d1d1f] block mb-2">Investment Horizon</label>
                <div className="flex gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setPeriod(opt.value)}
                      className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all border"
                      style={{ background: period === opt.value ? "#0071e3" : "#f5f5f7", color: period === opt.value ? "white" : "#6e6e73", borderColor: period === opt.value ? "#0071e3" : "#e5e5ea" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium text-[#1d1d1f] block mb-3">Hurdle Rate Components</label>
                <div className="space-y-3">
                  {[
                    { label: "Inflation Rate",  value: inflation,    setter: setInflation,   hint: "Expected annual inflation %" },
                    { label: "Borrowing Cost",  value: borrowing,    setter: setBorrowing,   hint: "Cost of capital / loan rate %" },
                    { label: "Index Return",    value: indexReturn,  setter: setIndexReturn, hint: "Expected index (S&P 500) return %" },
                    { label: "OpEx / Fees",     value: opex,         setter: setOpex,        hint: "Management fees / expenses %" },
                    { label: "Alpha Target",    value: alpha,        setter: setAlpha,       hint: "Extra return above market %" },
                  ].map(({ label, value, setter, hint }) => (
                    <div key={label} className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-[13px] text-[#1d1d1f] font-medium">{label}</p>
                        <p className="text-[11px] text-[#aeaeb2]">{hint}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="number" value={value} step={0.5} min={0} max={50}
                          onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                          className="w-20 rounded-xl border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[14px] text-right focus:outline-none focus:border-[#0071e3] focus:bg-white transition-all" />
                        <span className="text-[13px] text-[#6e6e73]">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#f0f0f0] pt-4 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#1d1d1f]">Total Hurdle Rate</span>
                <span className="text-[28px] font-semibold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</span>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={handleSave} disabled={saving}
                className="px-8 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#0071e3" }}>
                {saving ? "Creating…" : "Create Profile & Start Scanning →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
