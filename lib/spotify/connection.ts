import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getSessionSecretEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  getSpotifyCookieNames,
  isSpotifySessionForAuthUser,
} from "@/lib/spotify/oauth";

/**
 * Whether this browser holds a usable Spotify connection for the signed-in
 * WAXLIST account.
 *
 * Server components use this to decide whether it is worth calling the Spotify
 * API at all. Without it the crate view mounts its data loader, fires profile
 * and playlist requests with no session, and the collector sees a pair of
 * silent 401s instead of the reason the connect attempt failed.
 */
export async function getSpotifyConnectionState(
  authUserId: string,
): Promise<"connected" | "not_connected"> {
  const secret = getSessionSecretEnv();

  if (!secret.ok) {
    return "not_connected";
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(getSpotifyCookieNames().session)?.value;

  if (!value) {
    return "not_connected";
  }

  const session = decodeSpotifySession(value, secret.secret);

  if (!session || !isSpotifySessionForAuthUser(session, authUserId)) {
    return "not_connected";
  }

  // The API layer can refresh an expired token only when Spotify issued a
  // refresh token. Without one the refresh attempt is guaranteed to 401.
  if (session.expiresAt <= Date.now() && !session.refreshToken) {
    return "not_connected";
  }

  return "connected";
}

/**
 * Whether the WAXLIST account itself holds a Spotify link.
 *
 * The browser cookie is one half of the connection; `users.spotify_user_id` is
 * the other, and it is the half that decides whether a *different* WAXLIST
 * account may connect the same Spotify account. Profile needs it to offer a
 * disconnect that actually releases the claim.
 */
export async function isSpotifyAccountLinked(
  userId: string,
): Promise<boolean> {
  try {
    const [{ db }, schema] = await Promise.all([
      import("@/lib/db/client"),
      import("@/lib/db/schema"),
    ]);
    const [row] = await db
      .select({ spotifyUserId: schema.users.spotifyUserId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return Boolean(row?.spotifyUserId);
  } catch {
    // A database hiccup must not fail the workspace render; Profile simply
    // hides the disconnect action and the collector can retry on reload.
    return false;
  }
}

/**
 * Releases the Spotify link for one WAXLIST account.
 *
 * Clearing the cookie alone left the Spotify account permanently claimed,
 * because `users.spotify_user_id` and `spotify_accounts` are unique per Spotify
 * identity: every later connect from another WAXLIST account failed closed with
 * `claimed_by_another_account` and there was no way out of it. The encrypted
 * provider tokens are removed with the link so disconnect means disconnect.
 */
export async function releaseSpotifyConnection(userId: string) {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  await db.transaction(async (transaction) => {
    await transaction
      .delete(schema.spotifyAccounts)
      .where(eq(schema.spotifyAccounts.userId, userId));
    await transaction
      .update(schema.users)
      .set({ spotifyUserId: null, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  });
}
