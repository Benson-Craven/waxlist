import { SPOTIFY_CALLBACK_PATH } from "@/lib/constants";

type SpotifyOAuthEnv =
  | {
      ok: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type SessionSecretEnv =
  | {
      ok: true;
      secret: string;
      source: "SESSION_SECRET" | "AUTH_SECRET";
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type DiscogsEnv =
  | {
      ok: true;
      token: string;
      userAgent: string;
      requestDelayMs: number;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type ApiCacheEnv =
  | {
      ok: true;
      ttlMs: number;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type DatabaseEnv =
  | {
      ok: true;
      databaseUrl: string;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type WishlistEnv =
  | {
      ok: true;
      databaseUrl: string;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

type DiscogsMatchSecurityEnv =
  | {
      ok: true;
      maxBodyBytes: number;
      rateLimitWindowMs: number;
      rateLimitMaxRequests: number;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  spotifyRedirectUri:
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://localhost:3000/api/auth/spotify/callback",
  discogsUserAgent:
    process.env.DISCOGS_USER_AGENT ?? "Waxlist/0.1 +http://localhost:3000",
} as const;

function parseWholeNumberEnv(input: {
  key: string;
  rawValue: string | undefined;
  defaultValue: number;
  min: number;
  max: number;
  unitLabel: string;
}) {
  const rawValue = input.rawValue?.trim();

  if (!rawValue) {
    return {
      ok: true as const,
      value: input.defaultValue,
    };
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || String(parsed) !== rawValue) {
    return {
      ok: false as const,
      message: `${input.key} must be a whole number of ${input.unitLabel}, or omitted to use the ${input.defaultValue.toLocaleString()} ${input.unitLabel} default.`,
    };
  }

  if (parsed < input.min || parsed > input.max) {
    return {
      ok: false as const,
      message: `${input.key} must be between ${input.min.toLocaleString()} and ${input.max.toLocaleString()} ${input.unitLabel}.`,
    };
  }

  return {
    ok: true as const,
    value: parsed,
  };
}

export function getSpotifyOAuthEnv(): SpotifyOAuthEnv {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();

  const missing = (
    [
      ["SPOTIFY_CLIENT_ID", clientId],
      ["SPOTIFY_CLIENT_SECRET", clientSecret],
      ["SPOTIFY_REDIRECT_URI", redirectUri],
    ] satisfies Array<[string, string | undefined]>
  )
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      message: `Missing required Spotify OAuth environment variables: ${missing.join(
        ", ",
      )}.`,
    };
  }

  const validClientId = clientId;
  const validClientSecret = clientSecret;
  const validRedirectUri = redirectUri;

  if (!validClientId || !validClientSecret || !validRedirectUri) {
    return {
      ok: false,
      missing: [],
      message: "Spotify OAuth environment variables could not be validated.",
    };
  }

  try {
    const parsedRedirectUri = new URL(validRedirectUri);

    if (!["http:", "https:"].includes(parsedRedirectUri.protocol)) {
      return {
        ok: false,
        missing: [],
        message:
          "SPOTIFY_REDIRECT_URI must be an absolute http or https URL.",
      };
    }

    if (parsedRedirectUri.pathname !== SPOTIFY_CALLBACK_PATH) {
      return {
        ok: false,
        missing: [],
        message: `SPOTIFY_REDIRECT_URI must use callback path ${SPOTIFY_CALLBACK_PATH}.`,
      };
    }
  } catch {
    return {
      ok: false,
      missing: [],
      message: "SPOTIFY_REDIRECT_URI must be a valid absolute URL.",
    };
  }

  return {
    ok: true,
    clientId: validClientId,
    clientSecret: validClientSecret,
    redirectUri: validRedirectUri,
  };
}

export function getSessionSecretEnv(): SessionSecretEnv {
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  const authSecret = process.env.AUTH_SECRET?.trim();
  const secret = sessionSecret || authSecret;
  const source = sessionSecret ? "SESSION_SECRET" : "AUTH_SECRET";

  if (!secret) {
    return {
      ok: false,
      missing: ["SESSION_SECRET"],
      message:
        "Missing required session secret. Set SESSION_SECRET or AUTH_SECRET to a random value with at least 32 characters.",
    };
  }

  if (secret.length < 32) {
    return {
      ok: false,
      missing: [],
      message:
        `${source} must be at least 32 characters so Spotify session cookies can be encrypted safely.`,
    };
  }

  return {
    ok: true,
    secret,
    source,
  };
}

export function getDiscogsEnv(): DiscogsEnv {
  const token = process.env.DISCOGS_TOKEN?.trim();
  const userAgent = process.env.DISCOGS_USER_AGENT?.trim();
  const rawRequestDelayMs = process.env.DISCOGS_REQUEST_DELAY_MS?.trim();

  const missing = (
    [
      ["DISCOGS_TOKEN", token],
      ["DISCOGS_USER_AGENT", userAgent],
    ] satisfies Array<[string, string | undefined]>
  )
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      message: `Missing required Discogs environment variables: ${missing.join(
        ", ",
      )}.`,
    };
  }

  if (!token || !userAgent) {
    return {
      ok: false,
      missing: [],
      message: "Discogs environment variables could not be validated.",
    };
  }

  if (!userAgent.includes("/") || userAgent.length < 8) {
    return {
      ok: false,
      missing: [],
      message:
        "DISCOGS_USER_AGENT must be a unique app/version string such as Waxlist/0.1 +http://127.0.0.1:3000.",
    };
  }

  if (rawRequestDelayMs) {
    const requestDelayMs = parseWholeNumberEnv({
      key: "DISCOGS_REQUEST_DELAY_MS",
      rawValue: rawRequestDelayMs,
      defaultValue: 1100,
      min: 0,
      max: 60000,
      unitLabel: "milliseconds",
    });

    if (!requestDelayMs.ok) {
      return {
        ok: false,
        missing: [],
        message: requestDelayMs.message,
      };
    }

    return {
      ok: true,
      token,
      userAgent,
      requestDelayMs: requestDelayMs.value,
    };
  }

  return {
    ok: true,
    token,
    userAgent,
    requestDelayMs: 1100,
  };
}

export function getApiCacheEnv(): ApiCacheEnv {
  const rawTtl = process.env.API_CACHE_TTL_SECONDS?.trim();

  const ttlResult = !rawTtl
    ? ({
        ok: true as const,
        value: 15 * 60,
      })
    : parseWholeNumberEnv({
        key: "API_CACHE_TTL_SECONDS",
        rawValue: rawTtl,
        defaultValue: 15 * 60,
        min: 0,
        max: 86400,
        unitLabel: "seconds",
      });

  if (!ttlResult.ok) {
    return {
      ok: false,
      missing: [],
      message: ttlResult.message,
    };
  }

  if (ttlResult.value === 0) {
    return {
      ok: true,
      ttlMs: 0,
    };
  }

  const databaseEnv = getDatabaseEnv();

  if (!databaseEnv.ok) {
    return {
      ok: false,
      missing: databaseEnv.missing,
      message: `${databaseEnv.message} Persistent API caching requires DATABASE_URL. Set API_CACHE_TTL_SECONDS=0 to disable caching.`,
    };
  }

  return {
    ok: true,
    ttlMs: ttlResult.value * 1000,
  };
}

export function getDatabaseEnv(): DatabaseEnv {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return {
      ok: false,
      missing: ["DATABASE_URL"],
      message: "Missing required DATABASE_URL environment variable.",
    };
  }

  try {
    const parsed = new URL(databaseUrl);

    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      return {
        ok: false,
        missing: [],
        message: "DATABASE_URL must use a postgres:// or postgresql:// URL.",
      };
    }
  } catch {
    return {
      ok: false,
      missing: [],
      message: "DATABASE_URL must be a valid Postgres connection URL.",
    };
  }

  return {
    ok: true,
    databaseUrl,
  };
}

export function getWishlistEnv(): WishlistEnv {
  const databaseEnv = getDatabaseEnv();

  if (!databaseEnv.ok) {
    return {
      ok: false,
      missing: databaseEnv.missing,
      message: `${databaseEnv.message} Wishlist persistence requires DATABASE_URL.`,
    };
  }

  return {
    ok: true,
    databaseUrl: databaseEnv.databaseUrl,
  };
}

export function getDiscogsMatchSecurityEnv(): DiscogsMatchSecurityEnv {
  const maxBodyBytes = parseWholeNumberEnv({
    key: "DISCOGS_MATCH_MAX_BODY_BYTES",
    rawValue: process.env.DISCOGS_MATCH_MAX_BODY_BYTES,
    defaultValue: 64 * 1024,
    min: 1024,
    max: 1024 * 1024,
    unitLabel: "bytes",
  });
  const rateLimitWindowSeconds = parseWholeNumberEnv({
    key: "DISCOGS_MATCH_RATE_LIMIT_WINDOW_SECONDS",
    rawValue: process.env.DISCOGS_MATCH_RATE_LIMIT_WINDOW_SECONDS,
    defaultValue: 60,
    min: 1,
    max: 3600,
    unitLabel: "seconds",
  });
  const rateLimitMaxRequests = parseWholeNumberEnv({
    key: "DISCOGS_MATCH_RATE_LIMIT_MAX_REQUESTS",
    rawValue: process.env.DISCOGS_MATCH_RATE_LIMIT_MAX_REQUESTS,
    defaultValue: 8,
    min: 1,
    max: 1000,
    unitLabel: "requests",
  });
  const invalid = [maxBodyBytes, rateLimitWindowSeconds, rateLimitMaxRequests]
    .filter((result) => !result.ok)
    .map((result) => (result.ok ? "" : result.message));

  if (invalid.length > 0) {
    return {
      ok: false,
      missing: [],
      message: invalid.join(" "),
    };
  }

  if (
    !maxBodyBytes.ok ||
    !rateLimitWindowSeconds.ok ||
    !rateLimitMaxRequests.ok
  ) {
    return {
      ok: false,
      missing: [],
      message: "Discogs match security environment could not be validated.",
    };
  }

  return {
    ok: true,
    maxBodyBytes: maxBodyBytes.value,
    rateLimitWindowMs: rateLimitWindowSeconds.value * 1000,
    rateLimitMaxRequests: rateLimitMaxRequests.value,
  };
}
