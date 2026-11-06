import { NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { getNeonAuthEnv } from "@/lib/config";
import { loadDiscogsReleaseArtwork } from "@/lib/discogs/release-artwork";
import { verifyCollectionMarkToken } from "@/lib/listening/mark-token";
import { setNativeCollectionState } from "@/lib/listening/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return NextResponse.json(
      {
        error: {
          code: resolved.code,
          message: resolved.message,
        },
      },
      { status: resolved.code === "auth_required" ? 401 : 500 },
    );
  }

  const auth = getNeonAuthEnv();

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: {
          code: "auth_configuration_error",
          message: auth.message,
          missing: auth.missing,
        },
      },
      { status: 500 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const input =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const status =
    input.status === "owned" || input.status === "wanted"
      ? input.status
      : null;
  const markToken =
    typeof input.markToken === "string" ? input.markToken.trim() : "";

  if (!status || !markToken) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_collection_gap_state",
          message:
            "A server-verified catalogue match and owned or wanted state are required.",
        },
      },
      { status: 400 },
    );
  }

  const verified = verifyCollectionMarkToken({
    token: markToken,
    expectedUserId: resolved.owner.userId,
    secret: auth.cookieSecret,
  });

  if (!verified.ok) {
    return NextResponse.json(
      {
        error: {
          code:
            verified.code === "expired"
              ? "collection_gap_match_expired"
              : "invalid_collection_gap_match",
          message:
            verified.code === "expired"
              ? "This catalogue match expired. Match the crate again before updating collection state."
              : "This catalogue match could not be verified for the signed-in account.",
        },
      },
      { status: verified.code === "wrong_owner" ? 403 : 400 },
    );
  }

  const imageUrl = await loadDiscogsReleaseArtwork(verified.payload.releaseId);

  await setNativeCollectionState({
    owner: resolved.owner,
    status,
    releaseId: verified.payload.releaseId,
    masterId: verified.payload.masterId,
    artist: verified.payload.artist,
    title: verified.payload.title,
    format: verified.payload.format,
    year: verified.payload.year,
    imageUrl,
  });

  return NextResponse.json({ state: status });
}
