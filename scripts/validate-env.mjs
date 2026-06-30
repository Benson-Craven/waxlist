import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const callbackPath = "/api/auth/spotify/callback";

const required = [
  "SESSION_SECRET",
  "DATABASE_URL",
  "SPOTIFY_CLIENT_ID",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_REDIRECT_URI",
  "DISCOGS_USER_AGENT",
  "DISCOGS_TOKEN",
];

function redact(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "<set>";
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function isPlaceholder(value) {
  return /replace-|changeme|your_|placeholder|example/i.test(value);
}

const failures = [];

for (const key of required) {
  const value = process.env[key]?.trim();

  if (!value) {
    failures.push(`${key} is required.`);
    continue;
  }

  if (isPlaceholder(value)) {
    failures.push(`${key} still looks like a placeholder.`);
  }
}

const sessionSecret = process.env.SESSION_SECRET?.trim();
if (sessionSecret && sessionSecret.length < 32) {
  failures.push("SESSION_SECRET must be at least 32 characters.");
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);

    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      failures.push("DATABASE_URL must use postgres:// or postgresql://.");
    }

    if (!parsed.hostname) {
      failures.push("DATABASE_URL must include a hostname.");
    }
  } catch {
    failures.push("DATABASE_URL must be a valid Postgres URL.");
  }
}

const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();
if (spotifyRedirectUri) {
  try {
    const parsed = new URL(spotifyRedirectUri);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      failures.push("SPOTIFY_REDIRECT_URI must use http:// or https://.");
    }

    if (parsed.pathname !== callbackPath) {
      failures.push(`SPOTIFY_REDIRECT_URI path must be ${callbackPath}.`);
    }
  } catch {
    failures.push("SPOTIFY_REDIRECT_URI must be a valid absolute URL.");
  }
}

const discogsUserAgent = process.env.DISCOGS_USER_AGENT?.trim();
if (discogsUserAgent) {
  if (discogsUserAgent.length < 8 || !discogsUserAgent.includes("/")) {
    failures.push(
      "DISCOGS_USER_AGENT must be a unique app/version string, for example Waxlist/0.1 +http://127.0.0.1:3000.",
    );
  }
}

if (failures.length > 0) {
  console.error("Environment validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const safeSummary = {
  SESSION_SECRET: "<set>",
  DATABASE_URL: new URL(databaseUrl).hostname,
  SPOTIFY_CLIENT_ID: redact(process.env.SPOTIFY_CLIENT_ID.trim()),
  SPOTIFY_CLIENT_SECRET: "<set>",
  SPOTIFY_REDIRECT_URI: spotifyRedirectUri,
  DISCOGS_USER_AGENT: discogsUserAgent,
  DISCOGS_TOKEN: "<set>",
};

console.log("Environment validation passed:");
for (const [key, value] of Object.entries(safeSummary)) {
  console.log(`- ${key}: ${value}`);
}
