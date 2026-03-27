import { NextRequest, NextResponse } from "next/server";

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  const params = new URLSearchParams();
  const forward = [
    "inflation",
    "borrowing",
    "index_return",
    "opex",
    "alpha_target",
  ];
  for (const key of forward) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }

  const url = `${ORCHESTRATOR_URL}/analyze/${encodeURIComponent(ticker)}?${params}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || "Orchestrator error" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error:
          "Cannot reach orchestrator. Make sure FastAPI is running on " +
          ORCHESTRATOR_URL,
      },
      { status: 503 }
    );
  }
}
