import { getDatabaseEnv } from "@/lib/config";
import { normalizeBulkLocationRequest } from "@/lib/collection/location-batch";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
  updateCollectionLocations,
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

async function readJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest) {
  const configurationError = collectionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return NextResponse.json(
      {
        error: {
          code: "collection_auth_required",
          message: "Sign in before editing shelf locations.",
        },
      },
      { status: 401 },
    );
  }

  const payload = await readJsonBody(request);
  const parsed = normalizeBulkLocationRequest(payload);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_bulk_location_patch",
          message: parsed.reason,
        },
      },
      { status: 400 },
    );
  }

  const result = await updateCollectionLocations(
    owner,
    parsed.value.ids,
    parsed.value.location,
    parsed.value.mode,
  );

  return jsonWithCollectionOwnerCookies(owner, result);
}
