import {
  SPOTIFY_OAUTH_SCOPES,
  SPOTIFY_OAUTH_STATE_COOKIE,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export type SpotifySession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType: string;
};

export const spotifyCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export function createSpotifyOAuthState() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildSpotifyAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE_URL);

  authorizeUrl.searchParams.set("client_id", input.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", input.redirectUri);
  authorizeUrl.searchParams.set("state", input.state);
  authorizeUrl.searchParams.set("scope", SPOTIFY_OAUTH_SCOPES.join(" "));
  authorizeUrl.searchParams.set("show_dialog", "true");

  return authorizeUrl;
}

export function encodeSpotifySession(input: {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  tokenType: string;
}) {
  const payload = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: Date.now() + input.expiresIn * 1000,
    scope: input.scope,
    tokenType: input.tokenType,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeSpotifySession(value: string): SpotifySession | undefined {
  try {
    const payload = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<SpotifySession>;

    if (
      typeof payload.accessToken !== "string" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.tokenType !== "string"
    ) {
      return;
    }

    return {
      accessToken: payload.accessToken,
      refreshToken:
        typeof payload.refreshToken === "string"
          ? payload.refreshToken
          : undefined,
      expiresAt: payload.expiresAt,
      scope: typeof payload.scope === "string" ? payload.scope : undefined,
      tokenType: payload.tokenType,
    };
  } catch {
    return;
  }
}

export function getSpotifyCookieNames() {
  return {
    state: SPOTIFY_OAUTH_STATE_COOKIE,
    session: SPOTIFY_SESSION_COOKIE,
  };
}
