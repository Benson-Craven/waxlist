import { type NextRequest, NextResponse } from "next/server";

import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { getDatabaseEnv } from "@/lib/config";
import {
  buildSpinStats,
  normalizeSpinLogInput,
} from "@/lib/spins/record";
import {
  createSpinLogEntry,
  listSpinLogEntries,
} from "@/lib/spins/server";

export const runtime = "nodejs";

function configurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "spins_configuration_error",
        message: env.message,
        missing: env.missing,
      },
    },
    { status: 500 },
  );
}

function authRequired() {
  return NextResponse.json(
    {
      error: {
        code: "spins_auth_required",
        message: "Sign in before using your spin log.",
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
  const configError = configurationError();

  if (configError) {
    return configError;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return authRequired();
  }

  const spins = await listSpinLogEntries(owner);

  return jsonWithCollectionOwnerCookies(owner, {
    spins,
    stats: buildSpinStats(spins),
  });
}

export async function POST(request: NextRequest) {
  const configError = configurationError();

  if (configError) {
    return configError;
  }

  const payload = await readJsonBody(request);
  const input = normalizeSpinLogInput(payload);

  if (!input.ok) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_spin_log_entry",
          message: input.message,
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return authRequired();
  }

  const result = await createSpinLogEntry(owner, input.value);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.code,
          message: result.message,
        },
      },
      { status: result.code === "spin_record_not_found" ? 404 : 400 },
    );
  }

  return jsonWithCollectionOwnerCookies(
    owner,
    { spin: result.entry },
    201,
  );
}
