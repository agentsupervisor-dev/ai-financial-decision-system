"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Profile {
  id: number;
  name: string;
  investment_period: string;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

const PERIOD_LABELS: Record<string, string> = {
  "1yr": "Short-term · 1 year",
  "3yr": "Medium-term · 3 years",
  "5yr": "Long-term · 5+ years",
};

const APPLE = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" };

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setUserEmail(session.user.email ?? null);

      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setProfiles(json.profiles ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this profile?")) return;
    setDeleting(id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/profile/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
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
      {/* Nav */}
      <nav className="bg-[rgba(245,245,247,0.9)] backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => router.push(`/?t=${Date.now()}`)} className="text-[#0071e3] text-[13px] hover:underline">← Dashboard</button>
          <span className="text-[13px] text-[#6e6e73]">{userEmail}</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[32px] font-semibold text-[#1d1d1f] tracking-tight">Investment Profiles</h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">Manage your investment goals and hurdle rates.</p>
          </div>
          <button
            onClick={() => router.push("/profile/new")}
            className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "#0071e3" }}>
            + Add Profile
          </button>
        </div>

        {/* Profile list */}
        {profiles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-10 text-center">
            <p className="text-[#6e6e73] text-[15px] mb-5">No profiles yet. Create your first investment goal.</p>
            <button
              onClick={() => router.push("/profile/new")}
              className="px-6 py-3 rounded-xl text-[15px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "#0071e3" }}>
              Create Profile
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => {
              const hurdle = p.inflation + p.borrowing + p.index_return + p.opex + p.alpha_target;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-black/[0.08] shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1d1d1f]">{p.name}</h2>
                    <p className="text-[13px] text-[#6e6e73] mt-0.5">{PERIOD_LABELS[p.investment_period]}</p>
                    <div className="flex gap-4 mt-3 flex-wrap">
                      {[
                        ["Inflation", p.inflation],
                        ["Borrowing", p.borrowing],
                        ["Index", p.index_return],
                        ["OpEx", p.opex],
                        ["Alpha", p.alpha_target],
                      ].map(([label, val]) => (
                        <div key={label as string} className="text-center">
                          <p className="text-[10px] text-[#aeaeb2] uppercase tracking-wide">{label as string}</p>
                          <p className="text-[13px] font-medium text-[#3a3a3c]">{(val as number).toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 ml-6">
                    <div className="text-right">
                      <p className="text-[11px] text-[#aeaeb2]">Hurdle Rate</p>
                      <p className="text-[22px] font-semibold" style={{ color: "#0071e3" }}>{hurdle.toFixed(1)}%</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/profile/${p.id}`)}
                        className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#0071e3] bg-[#f0f6ff] hover:bg-[#e0efff] transition-colors">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="px-4 py-2 rounded-xl text-[13px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40">
                        {deleting === p.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
