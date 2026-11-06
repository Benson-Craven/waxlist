import { NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { requireServerCapability } from "@/lib/capabilities/server";
import {
  loadLatestListeningSnapshot,
  replaceListeningSnapshot,
} from "@/lib/listening/server";
import {
  normalizeYouTubeLinkEntries,
  YOUTUBE_LINK_MAX_ENTRIES,
  type YouTubeLinkEntryInput,
} from "@/lib/listening/youtube/normalize";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;

function authError(
  resolved: Awaited<ReturnType<typeof resolveAuthenticatedOwner>>,
) {
  return NextResponse.json(
    {
      error: {
        code: resolved.ok ? "auth_required" : resolved.code,
        message: resolved.ok ? "Sign in to continue." : resolved.message,
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

  const capability = requireServerCapability("youtubeLinks");

  if (!capability.ok) {
    return NextResponse.json({ error: capability.error }, { status: 404 });
  }

  const snapshot = await loadLatestListeningSnapshot(
    resolved.owner,
    "youtube",
    "video_links",
  );

  return NextResponse.json({ snapshot });
}

export async function POST(request: Request) {
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return authError(resolved);
  }

  const capability = requireServerCapability("youtubeLinks");

  if (!capability.ok) {
    return NextResponse.json({ error: capability.error }, { status: 404 });
  }

  const bodyResult = await readLimitedJsonRequest(request, MAX_BODY_BYTES);

  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        error: {
          code: bodyResult.code,
          message: bodyResult.message,
        },
      },
      { status: bodyResult.status },
    );
  }

  const body =
    bodyResult.value && typeof bodyResult.value === "object"
      ? (bodyResult.value as { entries?: unknown })
      : {};

  if (
    !Array.isArray(body.entries) ||
    body.entries.length === 0 ||
    body.entries.length > YOUTUBE_LINK_MAX_ENTRIES ||
    body.entries.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as { url?: unknown }).url !== "string",
    )
  ) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_youtube_links",
          message: `Provide between one and ${YOUTUBE_LINK_MAX_ENTRIES} individual YouTube video links.`,
        },
      },
      { status: 400 },
    );
  }

  const normalized = normalizeYouTubeLinkEntries({
    entries: body.entries as YouTubeLinkEntryInput[],
  });

  if (normalized.issues.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_youtube_links",
          message: normalized.issues[0]?.message ?? "Review the YouTube links.",
          issues: normalized.issues,
        },
      },
      { status: 400 },
    );
  }

  if (normalized.snapshot.candidates.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_youtube_links",
          message: "Add at least one individual YouTube video link.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const snapshot = await replaceListeningSnapshot(
      resolved.owner,
      normalized.snapshot,
    );

    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "listening_snapshot_persistence_error",
          message:
            "The YouTube links could not be saved. Your previous link crate is still available.",
        },
      },
      { status: 500 },
    );
  }
}
