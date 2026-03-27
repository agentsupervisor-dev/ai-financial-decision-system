"use client";

import { useScan } from "@/lib/ScanContext";

export default function ToastContainer() {
  const { toasts, dismissToast } = useScan();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>
      {toasts.map((toast) => (
        <div key={toast.id}
          className="flex items-start gap-4 bg-white border border-black/[0.08] rounded-2xl shadow-xl px-5 py-4 w-[340px]"
          style={{ animation: "slideIn 0.3s ease" }}>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#1d1d1f]">Scan Complete</p>
            <p className="text-[13px] text-[#6e6e73] mt-0.5">
              <span className="font-medium text-[#1d1d1f]">{toast.profileName}</span>
              {" "}— {toast.total_passing} of {toast.total_scanned} stocks cleared hurdle
            </p>
          </div>
          <button onClick={() => dismissToast(toast.id)}
            className="text-[#aeaeb2] hover:text-[#1d1d1f] text-[18px] leading-none mt-0.5 transition-colors">
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
