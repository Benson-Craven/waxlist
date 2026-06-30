import { getSpotifyCookieNames, spotifyCookieOptions } from "@/lib/spotify/oauth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const url = new URL("/", request.url);
  url.searchParams.set("spotify", "disconnected");

  const response = NextResponse.redirect(url, 303);
  const cookieNames = getSpotifyCookieNames();

  response.cookies.set(cookieNames.session, "", {
    ...spotifyCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(cookieNames.state, "", {
    ...spotifyCookieOptions,
    maxAge: 0,
  });

  return response;
}
