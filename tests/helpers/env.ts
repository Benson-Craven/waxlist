const ENV_KEYS = [
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI",
  "SESSION_SECRET",
  "AUTH_SECRET",
  "DISCOGS_TOKEN",
  "DISCOGS_USER_AGENT",
  "DISCOGS_REQUEST_DELAY_MS",
  "API_CACHE_TTL_SECONDS",
  "DATABASE_URL",
  "DISCOGS_MATCH_MAX_BODY_BYTES",
  "DISCOGS_MATCH_RATE_LIMIT_WINDOW_SECONDS",
  "DISCOGS_MATCH_RATE_LIMIT_MAX_REQUESTS",
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
