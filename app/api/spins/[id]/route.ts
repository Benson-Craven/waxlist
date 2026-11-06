import { type NextRequest, NextResponse } from "next/server";

import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { getDatabaseEnv } from "@/lib/config";
import { deleteSpinLogEntry } from "@/lib/spins/server";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        message: "Sign in before editing your spin log.",
      },
    },
    { status: 401 },
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const configError = configurationError();

  if (configError) {
    return configError;
  }

  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_spin_log_id",
          message: "Spin log entry id is invalid.",
        },
      },
      { status: 400 },
    );
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return authRequired();
  }

  const deleted = await deleteSpinLogEntry(owner, id);

  if (!deleted) {
    return NextResponse.json(
      {
        error: {
          code: "spin_log_entry_not_found",
          message: "Spin log entry was not found.",
        },
      },
      { status: 404 },
    );
  }

  return jsonWithCollectionOwnerCookies(owner, { deleted: true });
}
