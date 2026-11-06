import { NextResponse } from "next/server";

import { requireServerCapability } from "@/lib/capabilities/server";

export const runtime = "nodejs";

function disabledResponse() {
  const capability = requireServerCapability("youtubeWatchHistory");

  return NextResponse.json(
    {
      error: capability.ok
        ? {
            code: "capability_disabled",
            capability: "youtubeWatchHistory",
            message:
              "YouTube watch-history import is not implemented in this WAXLIST build.",
          }
        : capability.error,
    },
    { status: 404 },
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
