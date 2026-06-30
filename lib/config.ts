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

type DiscogsEnv =
  | {
      ok: true;
      token: string;
      userAgent: string;
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

export function getDiscogsEnv(): DiscogsEnv {
  const token = process.env.DISCOGS_TOKEN?.trim();
  const userAgent = process.env.DISCOGS_USER_AGENT?.trim();

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

  return {
    ok: true,
    token,
    userAgent,
  };
}
