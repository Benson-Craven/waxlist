import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import {
  copyCookieHeaders,
  fetchSpotifyJson,
  getSpotifyAuthorizedRequest,
  spotifyApiErrorResponse,
} from "@/lib/spotify/api";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SpotifyProfileResponse = {
  id: string;
  display_name?: string | null;
  country?: string;
  product?: string;
  uri: string;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url: string;
    width?: number | null;
    height?: number | null;
  }>;
};

export async function GET(request: NextRequest) {
  const disabled = disabledCapabilityResponse("spotifyImport");
  if (disabled) return disabled;
  const owner = await resolveAuthenticatedOwner();

  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.code === "auth_required" ? 401 : 500 },
    );
  }

  const authorized = await getSpotifyAuthorizedRequest(
    request,
    owner.owner.authUserId,
  );

  if (!authorized.ok) {
    return authorized.response;
  }

  const spotifyResponse = await fetchSpotifyJson<SpotifyProfileResponse>(
    "/me",
    authorized.session,
  );

  if (!spotifyResponse.ok) {
    return spotifyApiErrorResponse(
      spotifyResponse.status,
      spotifyResponse.payload,
      "Spotify profile could not be fetched.",
      authorized.response,
    );
  }

  const profile = spotifyResponse.payload as SpotifyProfileResponse;
  const response = NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.display_name ?? null,
      country: profile.country ?? null,
      product: profile.product ?? null,
      uri: profile.uri,
      externalUrl: profile.external_urls?.spotify ?? null,
      imageUrl: profile.images?.[0]?.url ?? null,
    },
  });

  copyCookieHeaders(authorized.response, response);

  return response;
}
