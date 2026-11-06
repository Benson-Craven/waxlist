import { NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { getAppUrl } from "@/lib/config";
import {
  releaseSpotifyConnection,
} from "@/lib/spotify/connection";
import { clearSpotifyAuthCookies } from "@/lib/spotify/oauth";

export const runtime = "nodejs";

const DISCONNECTED_PATH = "/app?view=profile&spotify=disconnected";

export async function POST() {
  const owner = await resolveAuthenticatedOwner();

  if (owner.ok) {
    try {
      await releaseSpotifyConnection(owner.owner.userId);
    } catch {
      // Cookies still need clearing so the browser stops presenting a session
      // for an account whose stored tokens could not be removed.
      console.error("[spotify-disconnect] Spotify link release failed.");
    }
  }

  const response = NextResponse.redirect(
    owner.ok ? getAppUrl(DISCONNECTED_PATH) : getAppUrl("/"),
    303,
  );

  clearSpotifyAuthCookies(response);

  return response;
}
