"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: number;
  name: string;
  investment_period: string;
  inflation: number;
  borrowing: number;
  index_return: number;
  opex: number;
  alpha_target: number;
}

export interface StockResult {
  ticker: string;
  final_decision: string | null;
  composite_score: number | null;
  forensic_score: number | null;
  macro_score: number | null;
  asymmetry_score: number | null;
  confidence: number | null;
  expected_return: number | null;
  hurdle_rate: number | null;
  excess_return: number | null;
  clears_hurdle: boolean | null;
  decision_summary: string | null;
}

export interface ScanState {
  profileId: number;
  profileName: string;
  status: "running" | "completed" | "failed";
  results: StockResult[];
  total_scanned: number;
  total_passing: number;
  hurdle_rate: number;
  startedAt: number;
}

interface Toast {
  id: number;
  profileName: string;
  total_passing: number;
  total_scanned: number;
}

interface ScanContextValue {
  profiles: Profile[];
  userEmail: string | null;
  profilesLoaded: boolean;
  refreshProfiles: () => Promise<void>;
  scans: Record<number, ScanState>;
  scanProgress: Record<number, number>;
  toasts: Toast[];
  startScan: (profileId: number, profileName: string) => void;
  dismissToast: (id: number) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

const PROGRESS_DURATION = 180000;
const PROGRESS_TARGET = 92;

export function ScanProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [scans, setScans] = useState<Record<number, ScanState>>({});
  const [scanProgress, setScanProgress] = useState<Record<number, number>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refreshProfiles = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfilesLoaded(true); return; }
    setUserEmail(session.user.email ?? null);
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } catch { /* ignore */ }
    setProfilesLoaded(true);
  }, []);

  // Load profiles once on mount
  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  // Global progress ticker for all running scans
  useEffect(() => {
    const id = setInterval(() => {
      setScans((prev) => {
        const running = Object.values(prev).filter((s) => s.status === "running");
        if (running.length === 0) return prev;
        setScanProgress((p) => {
          const next = { ...p };
          for (const s of running) {
            const elapsed = Date.now() - s.startedAt;
            next[s.profileId] = Math.min((elapsed / PROGRESS_DURATION) * PROGRESS_TARGET, PROGRESS_TARGET);
          }
          return next;
        });
        return prev;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const startScan = useCallback(async (profileId: number, profileName: string) => {
    setScans((prev) => ({
      ...prev,
      [profileId]: {
        profileId, profileName, status: "running",
        results: [], total_scanned: 0, total_passing: 0, hurdle_rate: 0,
        startedAt: Date.now(),
      },
    }));
    setScanProgress((p) => ({ ...p, [profileId]: 0 }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/scan?profile_id=${profileId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setScans((prev) => ({
        ...prev,
        [profileId]: {
          ...prev[profileId], status: "completed",
          results: data.results, total_scanned: data.total_scanned,
          total_passing: data.total_passing, hurdle_rate: data.profile.hurdle_rate,
        },
      }));
      setScanProgress((p) => ({ ...p, [profileId]: 100 }));

      const id = ++toastId.current;
      setToasts((prev) => [...prev, { id, profileName, total_passing: data.total_passing, total_scanned: data.total_scanned }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
    } catch {
      setScans((prev) => ({
        ...prev,
        [profileId]: { ...prev[profileId], status: "failed" },
      }));
      setScanProgress((p) => ({ ...p, [profileId]: 0 }));
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ScanContext.Provider value={{ profiles, userEmail, profilesLoaded, refreshProfiles, scans, scanProgress, toasts, startScan, dismissToast }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
