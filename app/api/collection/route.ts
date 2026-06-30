import { getDatabaseEnv } from "@/lib/config";
import {
  jsonWithCollectionOwnerCookies,
  listCollectionRecords,
  resolveCollectionOwner,
  seedCollectionFromWishlist,
} from "@/lib/collection/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function collectionConfigurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "collection_configuration_error",
        message: env.message,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

function collectionAuthRequired() {
  return NextResponse.json(
    {
      error: {
        code: "collection_auth_required",
        message: "Connect Spotify before using the collection workspace.",
      },
    },
    { status: 401 },
  );
}

async function readJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const configurationError = collectionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return collectionAuthRequired();
  }

  const records = await listCollectionRecords(owner);

  return jsonWithCollectionOwnerCookies(owner, { records });
}

export async function POST(request: NextRequest) {
  const configurationError = collectionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const payload = await readJsonBody(request);
  const source =
    payload && typeof payload === "object" && "source" in payload
      ? (payload as { source?: unknown }).source
      : null;

  if (source !== "wishlist") {
    return NextResponse.json(
      {
        error: {
          code: "invalid_collection_seed_source",
          message: "Collection seed source must be wishlist.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return collectionAuthRequired();
  }

  const result = await seedCollectionFromWishlist(owner);

  return jsonWithCollectionOwnerCookies(owner, result, 201);
}
