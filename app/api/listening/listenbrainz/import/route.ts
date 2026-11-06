import { NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { requireServerCapability } from "@/lib/capabilities/server";
import {
  fetchListenBrainzListens,
  ListenBrainzApiError,
} from "@/lib/listening/listenbrainz/client";
import { normalizeListenBrainzListens } from "@/lib/listening/listenbrainz/normalize";
import {
  loadLatestListeningSnapshot,
  replaceListeningSnapshot,
} from "@/lib/listening/server";

export const runtime = "nodejs";

const WINDOWS = new Set([30, 90, 365]);

function authError(resolved: Awaited<ReturnType<typeof resolveAuthenticatedOwner>>) {
  return NextResponse.json(
    {
      error: {
        code: resolved.ok ? "auth_required" : resolved.code,
        message: resolved.ok ? "Sign in to continue." : resolved.message,
        ...(!resolved.ok && resolved.missing.length > 0
          ? { missing: resolved.missing }
          : {}),
      },
    },
    { status: resolved.ok || resolved.code === "auth_required" ? 401 : 500 },
  );
}

export async function GET() {
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return authError(resolved);
  }

  const snapshot = await loadLatestListeningSnapshot(
    resolved.owner,
    "listenbrainz",
    "listening_history",
  );

  return NextResponse.json({ snapshot });
}

export async function POST(request: Request) {
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return authError(resolved);
  }

  const capability = requireServerCapability("listenbrainzImport");

  if (!capability.ok) {
    return NextResponse.json({ error: capability.error }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const input =
    payload && typeof payload === "object"
      ? (payload as { username?: unknown; windowDays?: unknown })
      : {};
  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  const requestedWindow = Number(input.windowDays ?? 90);

  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(username)) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_listenbrainz_username",
          message: "Enter a valid ListenBrainz username.",
        },
      },
      { status: 400 },
    );
  }

  if (!WINDOWS.has(requestedWindow)) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_listening_window",
          message: "Listening window must be 30, 90, or 365 days.",
        },
      },
      { status: 400 },
    );
  }

  const windowDays = requestedWindow as 30 | 90 | 365;

  try {
    const providerResult = await fetchListenBrainzListens({
      username,
      windowDays,
    });
    const snapshot = normalizeListenBrainzListens({
      listens: providerResult.listens,
      sourceAccountId: username,
      windowDays,
    });

    await replaceListeningSnapshot(resolved.owner, snapshot);

    return NextResponse.json({
      snapshot,
      rateLimit: providerResult.rateLimit,
    });
  } catch (error) {
    if (error instanceof ListenBrainzApiError) {
      return NextResponse.json(
        { error: error.toStructuredError() },
        {
          status:
            error.code === "listenbrainz_user_not_found"
              ? 404
              : error.code === "listenbrainz_rate_limited"
                ? 429
                : 502,
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "listening_snapshot_persistence_error",
          message:
            "The new crate could not be saved. Your previous crate is still available.",
        },
      },
      { status: 500 },
    );
  }
}
