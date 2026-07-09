import {
  SPOTIFY_OAUTH_SCOPES,
  SPOTIFY_OAUTH_STATE_COOKIE,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SPOTIFY_SESSION_REFRESH_SKEW_MS = 60 * 1000;

const SPOTIFY_SESSION_COOKIE_VERSION = "v1";
const SPOTIFY_SESSION_IV_BYTES = 12;

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

type SpotifyCookieResponse = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: typeof spotifyCookieOptions & { maxAge: number },
    ) => void;
  };
};

export function clearSpotifyAuthCookies(response: SpotifyCookieResponse) {
  const cookieNames = getSpotifyCookieNames();

  response.cookies.set(cookieNames.session, "", {
    ...spotifyCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(cookieNames.state, "", {
    ...spotifyCookieOptions,
    maxAge: 0,
  });
}

export function createSpotifyOAuthState() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function shouldRefreshSpotifySession(session: SpotifySession) {
  return session.expiresAt <= Date.now() + SPOTIFY_SESSION_REFRESH_SKEW_MS;
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

function getSessionEncryptionKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encodeSpotifySession(
  input: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    scope?: string;
    tokenType: string;
  },
  secret: string,
) {
  const payload = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: Date.now() + input.expiresIn * 1000,
    scope: input.scope,
    tokenType: input.tokenType,
  };
  const iv = randomBytes(SPOTIFY_SESSION_IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getSessionEncryptionKey(secret),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    SPOTIFY_SESSION_COOKIE_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decodeSpotifySession(
  value: string,
  secret: string,
): SpotifySession | undefined {
  try {
    const [version, encodedIv, encodedAuthTag, encodedCiphertext] =
      value.split(".");

    if (
      version !== SPOTIFY_SESSION_COOKIE_VERSION ||
      !encodedIv ||
      !encodedAuthTag ||
      !encodedCiphertext
    ) {
      return;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSessionEncryptionKey(secret),
      Buffer.from(encodedIv, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]);
    const payload = JSON.parse(
      decrypted.toString("utf8"),
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
