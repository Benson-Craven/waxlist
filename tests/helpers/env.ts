const ENV_KEYS = [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI",
  "NEXT_PUBLIC_APP_URL",
  "SESSION_SECRET",
  "AUTH_SECRET",
  "DISCOGS_TOKEN",
  "DISCOGS_USER_AGENT",
  "DISCOGS_REQUEST_DELAY_MS",
  "API_CACHE_TTL_SECONDS",
  "DATABASE_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "DISCOGS_MATCH_MAX_BODY_BYTES",
  "DISCOGS_MATCH_RATE_LIMIT_WINDOW_SECONDS",
  "DISCOGS_MATCH_RATE_LIMIT_MAX_REQUESTS",
  "WAXLIST_BETA_INVITE_EMAILS",
  "WAXLIST_ENABLE_SPOTIFY_IMPORT",
  "WAXLIST_ENABLE_PRESSING_PROOF",
  "WAXLIST_ENABLE_DISCOGS_COLLECTION_SYNC",
  "WAXLIST_ENABLE_DISCOGS_MARKETPLACE",
  "WAXLIST_ENABLE_SELLER_SCOUT",
  "WAXLIST_ENABLE_DISCOGS_RESTRICTED_DATA",
] as const;

type EnvSnapshot = Partial<Record<(typeof ENV_KEYS)[number], string>>;

export function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as EnvSnapshot;
}

export function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}
