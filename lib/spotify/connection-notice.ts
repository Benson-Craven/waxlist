/**
 * Curated copy for the Spotify connect/disconnect round trip.
 *
 * The callback and refresh routes redirect with `?spotify=<status>&reason=<code>`.
 * Those codes are internal, provider-derived, and occasionally raw Spotify error
 * strings, so they are never rendered directly. Every code that can reach a
 * collector is mapped here; anything unrecognised falls back to a generic
 * retry message instead of leaking a provider value into the UI.
 */

export type SpotifyConnectionStatus =
  | "connected"
  | "disconnected"
  | "claimed"
  | "error";

export type SpotifyConnectionNotice = {
  tone: "success" | "info" | "error";
  title: string;
  message: string;
  /** Whether the notice should offer the Connect Spotify action. */
  action: "connect" | "retry" | null;
};

type NoticeCopy = Omit<SpotifyConnectionNotice, "tone">;

const RETRY_NOTICE: NoticeCopy = {
  title: "Spotify didn't connect",
  message:
    "Nothing changed. Start the connection again from this page.",
  action: "retry",
};

/**
 * Codes the app itself produces for a failed link, plus the ones Spotify can
 * return during the token exchange. Kept explicit so a new provider value can
 * never be reflected to the user by accident.
 */
const REASON_NOTICES: Record<string, NoticeCopy> = {
  claimed_by_another_account: {
    title: "This Spotify account is already connected",
    message:
      "It's linked to a different WAXLIST account, and one Spotify account can belong to only one WAXLIST account. Sign in there and disconnect Spotify first.",
    action: null,
  },
  current_account_linked_elsewhere: {
    title: "Your account is connected to another Spotify account",
    message:
      "This account already holds a different Spotify connection. Disconnect Spotify from Profile, then connect the one you want.",
    action: "connect",
  },
  current_account_has_data: {
    title: "This Spotify account can't be claimed automatically",
    message:
      "This Spotify account still holds listening data from before WAXLIST accounts, and your current account already has records. Claiming won't merge two accounts that both hold data.",
    action: null,
  },
  no_matching_legacy: {
    title: "Nothing to claim",
    message:
      "This Spotify account isn't linked to an earlier WAXLIST session, so there's nothing to claim.",
    action: null,
  },
  invalid_state: {
    title: "Spotify sign-in expired",
    message:
      "The sign-in timed out or started in another tab. Start it again.",
    action: "retry",
  },
  token_exchange_failed: RETRY_NOTICE,
  profile_lookup_failed: RETRY_NOTICE,
  invalid_token_response: RETRY_NOTICE,
  access_denied: {
    title: "Spotify access was not granted",
    message:
      "Spotify didn't grant access, so nothing connected. Try again and accept the permissions.",
    action: "retry",
  },
  connection_failed: {
    title: "WAXLIST couldn't save the connection",
    message:
      "Spotify signed in, but WAXLIST couldn't save it. Try again in a moment.",
    action: "retry",
  },
  configuration_error: {
    title: "Spotify isn't configured",
    message:
      "Spotify isn't set up for this build. Ask the beta owner to finish it.",
    action: null,
  },
  spotify_session_expired: {
    title: "Spotify session ended",
    message:
      "The connection expired or was revoked. Connect Spotify again.",
    action: "connect",
  },
  spotify_session_invalid: {
    title: "Spotify session ended",
    message:
      "The saved connection couldn't be read. Connect Spotify again.",
    action: "connect",
  },
  spotify_session_account_mismatch: {
    title: "Spotify connection belongs to another account",
    message:
      "This connection belongs to a different WAXLIST account. Connect Spotify again from this one.",
    action: "connect",
  },
  spotify_not_connected: {
    title: "Spotify isn't connected",
    message:
      "Connect Spotify to bring playlists and saved albums into the crate.",
    action: "connect",
  },
};

const STATUS_NOTICES: Record<
  Exclude<SpotifyConnectionStatus, "error">,
  NoticeCopy
> = {
  connected: {
    title: "Spotify connected",
    message: "Playlists and saved albums are ready in the crate.",
    action: null,
  },
  disconnected: {
    title: "Spotify disconnected",
    message:
      "Spotify is released from this account, so it can connect somewhere else now.",
    action: null,
  },
  claimed: {
    title: "Spotify data claimed",
    message:
      "Your earlier Spotify data now belongs to this account.",
    action: null,
  },
};

export function getSpotifyConnectionNotice(input: {
  status?: string | null;
  reason?: string | null;
}): SpotifyConnectionNotice | null {
  const status = input.status;
  const reason = input.reason;

  if (status === "connected" || status === "disconnected" || status === "claimed") {
    return { tone: "success", ...STATUS_NOTICES[status] };
  }

  if (status !== "error" && !reason) {
    return null;
  }

  if (reason && Object.prototype.hasOwnProperty.call(REASON_NOTICES, reason)) {
    return { tone: "error", ...REASON_NOTICES[reason] };
  }

  return { tone: "error", ...RETRY_NOTICE };
}
