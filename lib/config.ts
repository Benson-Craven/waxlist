export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  spotifyRedirectUri:
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://localhost:3000/api/auth/spotify/callback",
  discogsUserAgent:
    process.env.DISCOGS_USER_AGENT ?? "Waxlist/0.1 +http://localhost:3000",
} as const;
