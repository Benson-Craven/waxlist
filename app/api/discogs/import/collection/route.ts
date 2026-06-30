import {
  getDiscogsImportConfigurationError,
  getLatestDiscogsImportRun,
  runDiscogsCollectionImport,
} from "@/lib/collection/discogs-import";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { getDatabaseEnv } from "@/lib/config";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function configurationError() {
  const databaseEnv = getDatabaseEnv();

  if (!databaseEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "discogs_import_configuration_error",
          message: `${databaseEnv.message} Discogs collection import requires DATABASE_URL.`,
          missing: databaseEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  const discogsEnvError = getDiscogsImportConfigurationError();

  if (discogsEnvError) {
    return NextResponse.json({ error: discogsEnvError }, { status: 500 });
  }

  return null;
}

function authRequired() {
  return NextResponse.json(
    {
      error: {
        code: "discogs_import_auth_required",
        message: "Connect Spotify before importing a Discogs collection.",
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

function readRunId(value: unknown) {
  if (!value || typeof value !== "object" || !("runId" in value)) {
    return undefined;
  }

  const runId = (value as { runId?: unknown }).runId;

  return typeof runId === "string" && runId.trim().length > 0
    ? runId.trim()
    : undefined;
}

export async function GET(request: NextRequest) {
  const configError = configurationError();

  if (configError) {
    return configError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return authRequired();
  }

  const progress = await getLatestDiscogsImportRun(owner);

  return jsonWithCollectionOwnerCookies(owner, { progress });
}

export async function POST(request: NextRequest) {
  const configError = configurationError();

  if (configError) {
    return configError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return authRequired();
  }

  const payload = await readJsonBody(request);
  const result = await runDiscogsCollectionImport({
    owner,
    runId: readRunId(payload),
  });

  return jsonWithCollectionOwnerCookies(owner, result, 202);
}
