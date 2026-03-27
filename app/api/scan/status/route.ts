import { NextRequest, NextResponse } from "next/server";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const profileId = new URL(req.url).searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({});

  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/status/${profileId}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}
