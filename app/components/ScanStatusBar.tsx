"use client";

import { useScan } from "@/lib/ScanContext";

const STAGES = [
  { label: "Forensic", sub: "Claude" },
  { label: "Macro", sub: "Gemini" },
  { label: "Asymmetry", sub: "DeepSeek" },
  { label: "Decision", sub: "Claude" },
];

export default function ScanStatusBar() {
  const { scans, scanProgress } = useScan();

  const runningScan = Object.values(scans).find((s) => s.status === "running");
  if (!runningScan) return null;

  const progress = scanProgress[runningScan.profileId] ?? 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-6 pb-5 pt-3"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}
    >
      <div className="max-w-3xl mx-auto">
        <p className="text-[11px] text-[#6e6e73] mb-1.5 text-center">
          Scanning <span className="font-medium text-[#1d1d1f]">{runningScan.profileName}</span> — you can navigate freely
        </p>
        <div className="relative rounded-xl overflow-hidden h-12 select-none shadow-lg">
          {/* Track */}
          <div className="absolute inset-0 bg-[#e5e5ea]" />
          {/* Green fill */}
          <div
            className="absolute inset-y-0 left-0 bg-[#34c759]"
            style={{ width: `${progress}%`, transition: "width 0.25s linear" }}
          />
          {/* Dividers */}
          <div className="absolute inset-0 flex pointer-events-none">
            {STAGES.map((_, i) => (
              <div key={i} className={`flex-1 ${i < STAGES.length - 1 ? "border-r border-white/30" : ""}`} />
            ))}
          </div>
          {/* Gray text */}
          <div className="absolute inset-0 flex">
            {STAGES.map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[11px] font-semibold text-[#3a3a3c]">{s.label}</span>
                <span className="text-[10px] text-[#aeaeb2]">{s.sub}</span>
              </div>
            ))}
          </div>
          {/* White text clipped to green */}
          <div
            className="absolute inset-0 flex"
            style={{ clipPath: `inset(0 ${100 - progress}% 0 0 round 12px)` }}
          >
            {STAGES.map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[11px] font-semibold text-white">{s.label}</span>
                <span className="text-[10px] text-white/70">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
