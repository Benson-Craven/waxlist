export const APP_NAME = "WAXLIST";

export const SPOTIFY_AUTH_START_PATH = "/api/auth/spotify/login";

export const SPOTIFY_AUTH_LOGOUT_PATH = "/api/auth/spotify/logout";

export const SPOTIFY_CALLBACK_PATH = "/api/auth/spotify/callback";

export const SPOTIFY_OAUTH_STATE_COOKIE = "waxlist_spotify_oauth_state";

export const SPOTIFY_SESSION_COOKIE = "waxlist_spotify_session";

export const SPOTIFY_OAUTH_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
] as const;

export const HOME_PAGE_COPY = {
  eyebrow: "Spotify-powered vinyl discovery",
  title: APP_NAME,
  tagline: "Turn your Spotify taste into a vinyl crate worth collecting.",
  cta: "Connect Spotify",
  privacy:
    "We only use your Spotify data to build your crate. You can disconnect anytime.",
} as const;
