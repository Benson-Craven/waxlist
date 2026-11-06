import { NextResponse } from "next/server";

import { getNeonAuthServer } from "@/lib/auth/server";
import { getAppUrl } from "@/lib/config";
import { WISHLIST_SESSION_COOKIE } from "@/lib/constants";
import { clearSpotifyAuthCookies } from "@/lib/spotify/oauth";

export async function POST() {
  const auth = getNeonAuthServer();

  if (auth.ok) {
    try {
      await auth.auth.signOut();
    } catch {
      // The redirect below still clears every local WAXLIST cookie, so a
      // provider hiccup cannot trap a collector in a signed-in shell.
      console.error("[auth-sign-out] Provider sign-out failed.");
    }
  }

  const response = NextResponse.redirect(getAppUrl("/"), 303);

  // Sign-out means sign-out: dropping only the WAXLIST account session would
  // leave the previous account's Spotify and wishlist sessions on this browser.
  clearSpotifyAuthCookies(response);
  response.cookies.delete(WISHLIST_SESSION_COOKIE);

  // The offline shell caches signed-in pages. Clear the browser cache and
  // local data so the next account cannot open them offline.
  response.headers.set("Clear-Site-Data", '"cache", "storage"');

  return response;
}
