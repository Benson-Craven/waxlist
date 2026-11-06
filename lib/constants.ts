export const APP_NAME = "WAXLIST";

export const AUTH_SIGN_IN_PATH = "/auth/sign-in";

export const AUTH_SIGN_UP_PATH = "/auth/sign-up";

export const AUTH_SIGN_OUT_PATH = "/api/auth/sign-out";

export const SPOTIFY_AUTH_START_PATH = "/api/auth/spotify/login";

export const SPOTIFY_AUTH_LOGOUT_PATH = "/api/auth/spotify/logout";

export const SPOTIFY_AUTH_REFRESH_PATH = "/api/auth/spotify/refresh";

export const SPOTIFY_CALLBACK_PATH = "/api/auth/spotify/callback";

export const SPOTIFY_OAUTH_STATE_COOKIE = "waxlist_spotify_oauth_state";

export const SPOTIFY_SESSION_COOKIE = "waxlist_spotify_session";

export const WISHLIST_SESSION_COOKIE = "waxlist_wishlist_session";

export const SPOTIFY_OAUTH_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
] as const;

export const HOME_PAGE_COPY = {
  eyebrow: "Listening in. Vinyl out.",
  title: APP_NAME,
  tagline:
    "Turn what you play into what you're missing, then keep track of every record you own.",
  cta: "Start with Spotify",
  privacy: "Invite-only beta. Your WAXLIST account stays separate from Spotify.",
  privacyLinkLabel: "Privacy",
  deletionLinkLabel: "Data deletion",
} as const;
