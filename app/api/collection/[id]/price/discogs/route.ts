import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import { getDatabaseEnv } from "@/lib/config";
import {
  fetchDiscogsPriceForRecord,
  loadRecordPriceSummaries,
} from "@/lib/collection/pricing-server";
import {
  getCollectionRecordById,
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function discogsPriceConfigurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "collection_price_configuration_error",
        message: `${env.message} Discogs pricing requires DATABASE_URL.`,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const disabled = disabledCapabilityResponse("discogsMarketplace");

  if (disabled) {
    return disabled;
  }

  const configurationError = discogsPriceConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const { id } = await context.params;

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

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return NextResponse.json(
      {
        error: {
          code: "collection_auth_required",
          message: "Sign in before fetching a Discogs price.",
        },
      },
      { status: 401 },
    );
  }

  const record = await getCollectionRecordById(owner, id);

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

  const summaries = await loadRecordPriceSummaries(owner, [record.id]);
  const result = await fetchDiscogsPriceForRecord(owner, {
    ...record,
    pricing: summaries.get(record.id) ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.code,
          message: result.message,
          retryAfterSeconds: result.retryAfterSeconds,
        },
      },
      { status: result.status },
    );
  }

  return jsonWithCollectionOwnerCookies(owner, {
    pricing: result.pricing,
    numForSale: result.numForSale,
  });
}
