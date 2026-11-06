import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import { getDatabaseEnv } from "@/lib/config";
import { refreshCollectionPrices } from "@/lib/collection/pricing-server";
import {
  jsonWithCollectionOwnerCookies,
  listCollectionRecords,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function priceRefreshConfigurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "collection_price_refresh_configuration_error",
        message: `${env.message} Price refresh requires DATABASE_URL.`,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

async function readLimit(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | { limit?: unknown }
    | null;
  const limit = Number(payload?.limit);

  return Number.isInteger(limit) ? limit : undefined;
}

export async function POST(request: NextRequest) {
  const disabled = disabledCapabilityResponse("discogsMarketplace");

  if (disabled) {
    return disabled;
  }

  const configurationError = priceRefreshConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return NextResponse.json(
      {
        error: {
          code: "collection_auth_required",
          message: "Sign in before refreshing record values.",
        },
      },
      { status: 401 },
    );
  }

  const records = await listCollectionRecords(owner, { keepArtwork: true });
  const result = await refreshCollectionPrices(owner, records, {
    limit: await readLimit(request),
  });

  return jsonWithCollectionOwnerCookies(owner, result);
}
