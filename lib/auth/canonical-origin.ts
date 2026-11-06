import "server-only";

import { headers } from "next/headers";

/**
 * Neon Auth session cookies and the Spotify OAuth callback are host-bound.
 * Serving sign-in from `localhost` and then bouncing the OAuth callback through
 * `127.0.0.1` drops the account cookie, which reads as a sign-in loop.
 */
export function getCanonicalOriginUrlFromHost(input: {
  requestHost: string | null | undefined;
  pathWithQuery: string;
  configuredAppUrl: string | undefined;
}): string | null {
  const configuredAppUrl = input.configuredAppUrl?.trim();

  if (!configuredAppUrl) return null;
  if (
    !input.pathWithQuery.startsWith("/") ||
    input.pathWithQuery.startsWith("//")
  ) {
    return null;
  }

  let canonicalOrigin: URL;

  try {
    canonicalOrigin = new URL(configuredAppUrl);
  } catch {
    return null;
  }

  const requestHost = (input.requestHost ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (!requestHost || requestHost === canonicalOrigin.host.toLowerCase()) {
    return null;
  }

  return new URL(input.pathWithQuery, canonicalOrigin.origin).toString();
}

export async function getCanonicalOriginRedirectUrl(pathWithQuery: string) {
  const requestHeaders = await headers();

  return getCanonicalOriginUrlFromHost({
    requestHost:
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    pathWithQuery,
    configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
}
