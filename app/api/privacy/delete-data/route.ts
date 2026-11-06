import { getWishlistEnv } from "@/lib/config";
import { deleteAuthIdentityById } from "@/lib/auth/identity-deletion";
import { getNeonAuthServer } from "@/lib/auth/server";
import { getSpotifyCookieNames, spotifyCookieOptions } from "@/lib/spotify/oauth";
import { PRESSING_PREVIEW_COOKIE } from "@/lib/pressing-proof/preview-session";
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

function clearNeonAuthCookies(response: NextResponse) {
  for (const name of [
    "__Secure-neon-auth.local.session_data",
    "__Secure-neon-auth.session_token",
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  }
}

function clearPressingPreviewCookie(response: NextResponse) {
  response.cookies.set(PRESSING_PREVIEW_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function deleteCurrentVisitorData(request: NextRequest) {
  const configurationError = deletionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveWishlistOwner(request);
  if (!owner) {
    return NextResponse.json(
      {
        error: {
          code: "data_deletion_auth_required",
          message: "Sign in before deleting account data.",
        },
      },
      { status: 401 },
    );
  }
  const deletion = await deleteOwnerData(owner);
  const auth = getNeonAuthServer();
  let authDeletion: { error?: unknown } | null = null;

  if (auth.ok) {
    try {
      authDeletion = await auth.auth.deleteUser({});
    } catch {
      authDeletion = null;
    }
  }

  let authIdentityDeleted = Boolean(
    auth.ok && authDeletion && !authDeletion.error,
  );

  if (!authIdentityDeleted && owner.authUserId) {
    try {
      authIdentityDeleted = await deleteAuthIdentityById(owner.authUserId);
    } catch {
      authIdentityDeleted = false;
    }
  }

  const acceptsHtml = request.headers
    .get("accept")
    ?.toLowerCase()
    .includes("text/html");

  let response: NextResponse;

  if (!authIdentityDeleted) {
    response = acceptsHtml
      ? NextResponse.redirect(
          new URL("/data-deletion?error=auth_identity", request.url),
          303,
        )
      : NextResponse.json(
          {
            error: {
              code: "auth_identity_deletion_failed",
              message:
                "WAXLIST data was deleted, but the sign-in identity could not be removed. Contact support before signing in again.",
              dataDeleted: true,
            },
          },
          { status: 502 },
        );
  } else {
    response = acceptsHtml
      ? NextResponse.redirect(new URL("/", request.url), 303)
      : NextResponse.json({
          ok: true,
          deletedUser: deletion.deletedUser,
          deletedAuthUser: true,
        });
  }

  copyWishlistCookieHeaders(owner, response);
  clearWishlistSessionCookie(response);
  clearSpotifyCookies(response);
  clearNeonAuthCookies(response);
  clearPressingPreviewCookie(response);

  return response;
}

export async function POST(request: NextRequest) {
  return deleteCurrentVisitorData(request);
}

export async function DELETE(request: NextRequest) {
  return deleteCurrentVisitorData(request);
}
