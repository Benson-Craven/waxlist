import { getWishlistEnv } from "@/lib/config";
import { getSpotifyCookieNames, spotifyCookieOptions } from "@/lib/spotify/oauth";
import {
  clearWishlistSessionCookie,
  copyWishlistCookieHeaders,
  deleteOwnerData,
  resolveWishlistOwner,
} from "@/lib/wishlist/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function deletionConfigurationError() {
  const env = getWishlistEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "data_deletion_configuration_error",
        message: env.message,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

function clearSpotifyCookies(response: NextResponse) {
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

async function deleteCurrentVisitorData(request: NextRequest) {
  const configurationError = deletionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveWishlistOwner(request);
  const deletion = await deleteOwnerData(owner);
  const acceptsHtml = request.headers
    .get("accept")
    ?.toLowerCase()
    .includes("text/html");

  const response = acceptsHtml
    ? NextResponse.redirect(new URL("/?spotify=disconnected", request.url), 303)
    : NextResponse.json({
        ok: true,
        deletedUser: deletion.deletedUser,
        clearedWishlistSession: deletion.clearedWishlistSession,
      });

  copyWishlistCookieHeaders(owner, response);
  clearWishlistSessionCookie(response);
  clearSpotifyCookies(response);

  return response;
}

export async function POST(request: NextRequest) {
  return deleteCurrentVisitorData(request);
}

export async function DELETE(request: NextRequest) {
  return deleteCurrentVisitorData(request);
}
