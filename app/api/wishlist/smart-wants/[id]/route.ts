import { getDatabaseEnv } from "@/lib/config";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { normalizeSmartWantInput } from "@/lib/wishlist/smart-want";
import {
  deleteSmartWant,
  getSmartWant,
  updateSmartWant,
} from "@/lib/wishlist/smart-want-server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function smartWantConfigurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "smart_want_configuration_error",
        message: env.message,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

function smartWantAuthRequired() {
  return NextResponse.json(
    {
      error: {
        code: "smart_want_auth_required",
        message: "Connect Spotify before editing Smart Wants.",
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
  const configurationError = smartWantConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const [{ id }, payload] = await Promise.all([
    context.params,
    readJsonBody(request),
  ]);
  const smartWant = normalizeSmartWantInput(
    payload && typeof payload === "object" && "smartWant" in payload
      ? (payload as { smartWant?: unknown }).smartWant
      : payload,
  );

  if (!id) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_smart_want_id",
          message: "Smart Want id is required.",
        },
      },
      { status: 400 },
    );
  }

  if (!smartWant) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_smart_want",
          message: "Smart Want update payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return smartWantAuthRequired();
  }

  const savedSmartWant = await updateSmartWant(owner, id, smartWant);

  if (!savedSmartWant) {
    return NextResponse.json(
      {
        error: {
          code: "smart_want_not_found",
          message: "Smart Want was not found.",
        },
      },
      { status: 404 },
    );
  }

  return jsonWithCollectionOwnerCookies(owner, { smartWant: savedSmartWant });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const configurationError = smartWantConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_smart_want_id",
          message: "Smart Want id is required.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return smartWantAuthRequired();
  }

  const existingSmartWant = await getSmartWant(owner, id);

  if (!existingSmartWant) {
    return NextResponse.json(
      {
        error: {
          code: "smart_want_not_found",
          message: "Smart Want was not found.",
        },
      },
      { status: 404 },
    );
  }

  await deleteSmartWant(owner, id);

  return jsonWithCollectionOwnerCookies(owner, { ok: true });
}
