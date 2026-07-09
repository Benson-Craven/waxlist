import { getDatabaseEnv } from "@/lib/config";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { normalizeSmartWantInput } from "@/lib/wishlist/smart-want";
import {
  createSmartWant,
  listSmartWants,
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
        message: "Connect Spotify before using Smart Wants.",
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
  const configurationError = smartWantConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return smartWantAuthRequired();
  }

  const smartWants = await listSmartWants(owner);

  return jsonWithCollectionOwnerCookies(owner, { smartWants });
}

export async function POST(request: NextRequest) {
  const configurationError = smartWantConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const payload = await readJsonBody(request);
  const smartWant = normalizeSmartWantInput(
    payload && typeof payload === "object" && "smartWant" in payload
      ? (payload as { smartWant?: unknown }).smartWant
      : payload,
  );

  if (!smartWant) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_smart_want",
          message: "Smart Want payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return smartWantAuthRequired();
  }

  const savedSmartWant = await createSmartWant(owner, smartWant);

  if (!savedSmartWant) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_smart_want",
          message: "Smart Want payload is invalid.",
        },
      },
      { status: 400 },
    );
  }

  return jsonWithCollectionOwnerCookies(
    owner,
    { smartWant: savedSmartWant },
    201,
  );
}
