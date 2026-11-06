import { getDatabaseEnv } from "@/lib/config";
import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import {
  AddCollectionRecordError,
  addCollectionRecord,
} from "@/lib/collection/add";
import {
  collectionRecordForOwner,
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
        message: "Sign in before using the collection workspace.",
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

  // The Collection carousel is the owner's own shelf, so it renders the
  // artwork stored with their records. Every other Restricted Data field stays
  // stripped by the same owner-only sanitizer.
  const records = await listCollectionRecords(owner, { keepArtwork: true });

  return jsonWithCollectionOwnerCookies(owner, { records });
}

export async function POST(request: NextRequest) {
  const configurationError = collectionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const payload = await readJsonBody(request);
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const source = body.source ?? null;

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return collectionAuthRequired();
  }

  if (source === "wishlist") {
    const disabled = disabledCapabilityResponse("discogsRestrictedData");
    if (disabled) return disabled;

    const result = await seedCollectionFromWishlist(owner);

    return jsonWithCollectionOwnerCookies(owner, result, 201);
  }

  const discogsReleaseId =
    typeof body.discogsReleaseId === "number"
      ? body.discogsReleaseId
      : typeof body.discogsReleaseId === "string"
        ? Number(body.discogsReleaseId)
        : Number.NaN;
  const status = body.status === "wanted" ? "wanted" : "owned";
  const favourite =
    typeof body.favourite === "boolean" ? body.favourite : undefined;

  try {
    const result = await addCollectionRecord(owner, {
      discogsReleaseId,
      status,
      favourite,
    });

    return jsonWithCollectionOwnerCookies(
      owner,
      {
        record: collectionRecordForOwner(result.record),
        existed: result.existed,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AddCollectionRecordError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            missing: error.missing,
          },
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "collection_add_failed",
          message: "The record could not be added to your collection.",
        },
      },
      { status: 500 },
    );
  }
}
