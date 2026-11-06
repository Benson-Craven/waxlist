import { AUTH_SIGN_IN_PATH } from "@/lib/constants";
import { CRATE_SOURCES, type CrateSource } from "@/lib/listening/sources";

const DEFAULT_SIGNED_IN_PATH = "/app";

/**
 * Auth pages and API routes are never valid post-sign-in destinations. Allowing
 * them would let a crafted `next` value bounce the browser between the sign-in
 * form and a route that immediately redirects back to it.
 */
const BLOCKED_NEXT_PREFIXES = ["/auth", "/api"];

function isBlockedNextPath(path: string) {
  return BLOCKED_NEXT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Normalises a `next` value into a relative, same-origin path.
 *
 * Only a single leading slash is accepted, so protocol-relative (`//host`),
 * backslash (`/\host`) and absolute (`https://host`) values all fall back.
 */
export function getSafeNextPath(
  value: unknown,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const candidate = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // Control characters can smuggle line breaks into Location headers.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  if (isBlockedNextPath(candidate)) return fallback;

  try {
    const base = "http://waxlist.invalid";
    const resolved = new URL(candidate, base);

    if (resolved.origin !== base) return fallback;

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export type SignInHrefInput = {
  next?: unknown;
  source?: string;
  status?: string;
};

export function buildSignInHref(input: SignInHrefInput = {}) {
  const params = new URLSearchParams();
  const next = getSafeNextPath(input.next, "");

  if (next) params.set("next", next);
  if (
    typeof input.source === "string" &&
    CRATE_SOURCES.includes(input.source as CrateSource)
  ) {
    params.set("source", input.source);
  }
  if (input.status) params.set("status", input.status);

  const query = params.toString();

  return query ? `${AUTH_SIGN_IN_PATH}?${query}` : AUTH_SIGN_IN_PATH;
}

/**
 * Rebuilds the same-origin auth URL from parsed query values so a host
 * canonicalisation redirect keeps the collector's destination and intent.
 */
export function buildAuthPagePath(input: {
  pathname: string;
  source?: unknown;
  next?: unknown;
  status?: unknown;
}) {
  const params = new URLSearchParams();
  const next = getSafeNextPath(input.next, "");
  const status = Array.isArray(input.status) ? input.status[0] : input.status;

  if (typeof input.source === "string" && input.source) {
    params.set("source", input.source);
  }
  if (next) params.set("next", next);
  if (typeof status === "string" && status) params.set("status", status);

  const query = params.toString();

  return query ? `${input.pathname}?${query}` : input.pathname;
}
