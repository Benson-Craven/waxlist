import { getDatabaseEnv } from "@/lib/config";
import { normalizeCollectionItemPatch } from "@/lib/collection/record";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
  updateCollectionRecord,
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
        message: "Connect Spotify before editing collection records.",
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const configurationError = collectionConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const [{ id }, payload] = await Promise.all([context.params, readJsonBody(request)]);
  const patch = normalizeCollectionItemPatch(payload);

  if (!id) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_collection_record_id",
          message: "Collection record id is required.",
        },
      },
      { status: 400 },
    );
  }

  if (!patch) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_collection_patch",
          message: "Collection update payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return collectionAuthRequired();
  }

  const record = await updateCollectionRecord(owner, id, patch);

  if (!record) {
    return NextResponse.json(
      {
        error: {
          code: "collection_record_not_found",
          message: "Collection record was not found.",
        },
      },
      { status: 404 },
    );
  }

  return jsonWithCollectionOwnerCookies(owner, { record });
}
