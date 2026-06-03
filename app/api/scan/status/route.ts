import { NextResponse } from "next/server";

// Agent status is now tracked client-side; this stub prevents 404s from the frontend poller.
export async function GET() {
  return NextResponse.json({});
}
