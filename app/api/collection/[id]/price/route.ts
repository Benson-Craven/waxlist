import { getDatabaseEnv } from "@/lib/config";
import {
  normalizeCollectionPriceInput,
  type RecordPriceSummary,
} from "@/lib/collection/pricing";
import {
  recordCollectionPriceSnapshot,
  loadRecordPriceSummaries,
} from "@/lib/collection/pricing-server";
import {
  getCollectionRecordById,
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function priceConfigurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "collection_price_configuration_error",
        message: `${env.message} Record values require DATABASE_URL.`,
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const configurationError = priceConfigurationError();

  if (configurationError) {
    return configurationError;
  }

  const [{ id }, payload] = await Promise.all([
    context.params,
    readJsonBody(request),
  ]);
  const input = normalizeCollectionPriceInput(payload);

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

  if (!input) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_collection_price",
          message:
            "Enter a value above zero with a three-letter currency, such as 24.50 GBP.",
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
          message: "Sign in before saving a record value.",
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

  let snapshot;

  try {
    snapshot = await recordCollectionPriceSnapshot(owner, {
      collectionItemId: record.id,
      discogsReleaseId: record.discogsReleaseId,
      amountCents: input.amountCents,
      currency: input.currency,
      source: "manual",
      observedAt: new Date(),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "collection_price_not_saved",
          message: "The record value could not be saved.",
        },
      },
      { status: 500 },
    );
  }

  if (!snapshot) {
    return NextResponse.json(
      {
        error: {
          code: "collection_price_not_saved",
          message: "The record value could not be saved.",
        },
      },
      { status: 500 },
    );
  }

  const summaries = await loadRecordPriceSummaries(owner, [record.id]);
  const pricing: RecordPriceSummary | null =
    summaries.get(record.id) ?? null;

  return jsonWithCollectionOwnerCookies(owner, { pricing }, 201);
}
