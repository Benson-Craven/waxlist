import { getWishlistEnv } from "@/lib/config";
import {
  copyWishlistCookieHeaders,
  listWishlistRecords,
  removeWishlistRecord,
  resolveWishlistOwner,
  saveWishlistRecord,
} from "@/lib/wishlist/server";
import { normalizeWishlistRecord } from "@/lib/wishlist/record";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function wishlistConfigurationError() {
  const env = getWishlistEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "wishlist_configuration_error",
        message: env.message,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

function jsonWithOwnerCookies(
  owner: Awaited<ReturnType<typeof resolveWishlistOwner>>,
  payload: Record<string, unknown>,
  status = 200,
) {
  const response = NextResponse.json(payload, { status });

  copyWishlistCookieHeaders(owner, response);

  return response;
}

async function readJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const configurationError = wishlistConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveWishlistOwner(request);
  const records = await listWishlistRecords(owner);

  return jsonWithOwnerCookies(owner, { records });
}

export async function POST(request: NextRequest) {
  const configurationError = wishlistConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const payload = await readJsonBody(request);
  const record = normalizeWishlistRecord(
    payload && typeof payload === "object" && "record" in payload
      ? (payload as { record?: unknown }).record
      : payload,
  );

  if (!record) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_wishlist_record",
          message: "Wishlist record payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveWishlistOwner(request);
  const savedRecord = await saveWishlistRecord(owner, record);

  return jsonWithOwnerCookies(owner, { record: savedRecord }, 201);
}

export async function DELETE(request: NextRequest) {
  const configurationError = wishlistConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const payload = await readJsonBody(request);
  const recordId =
    request.nextUrl.searchParams.get("recordId") ??
    (payload && typeof payload === "object" && "recordId" in payload
      ? (payload as { recordId?: unknown }).recordId
      : null);

  if (typeof recordId !== "string" || !recordId) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_wishlist_record_id",
          message: "Wishlist record id is required.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveWishlistOwner(request);

  await removeWishlistRecord(owner, recordId);

  return jsonWithOwnerCookies(owner, { ok: true });
}
