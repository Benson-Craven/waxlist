import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

import { getNeonAuthEnv } from "@/lib/config";

type NeonAuthServer = ReturnType<typeof createNeonAuth>;

let cachedAuth:
  | {
      key: string;
      server: NeonAuthServer;
    }
  | undefined;

export function getNeonAuthServer() {
  const env = getNeonAuthEnv();

  if (!env.ok) {
    return {
      ok: false as const,
      error: env,
    };
  }

  const key = `${env.baseUrl}:${env.cookieSecret}`;

  if (!cachedAuth || cachedAuth.key !== key) {
    cachedAuth = {
      key,
      server: createNeonAuth({
        baseUrl: env.baseUrl,
        cookies: {
          secret: env.cookieSecret,
          sameSite: "lax",
        },
      }),
    };
  }

  return {
    ok: true as const,
    auth: cachedAuth.server,
  };
}

export async function getNeonAuthSession() {
  const server = getNeonAuthServer();

  if (!server.ok) {
    return {
      ok: false as const,
      code: "auth_configuration_error" as const,
      message: server.error.message,
      missing: server.error.missing,
    };
  }

  let result: Awaited<ReturnType<NeonAuthServer["getSession"]>>;

  try {
    result = await server.auth.getSession();
  } catch {
    // Public pages call this on every request. A provider or database hiccup
    // must render an anonymous page, never a server error.
    return {
      ok: false as const,
      code: "auth_session_error" as const,
      message: "WAXLIST could not verify this sign-in session.",
      missing: [] as string[],
    };
  }

  if (result.error) {
    return {
      ok: false as const,
      code: "auth_session_error" as const,
      message: "WAXLIST could not verify this sign-in session.",
      missing: [] as string[],
    };
  }

  const user = result.data?.user;

  if (!user?.id) {
    return {
      ok: false as const,
      code: "auth_required" as const,
      message: "Sign in to continue.",
      missing: [] as string[],
    };
  }

  return {
    ok: true as const,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
    },
  };
}
