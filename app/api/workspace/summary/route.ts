import { type NextRequest, NextResponse } from "next/server";

import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import { getDatabaseEnv } from "@/lib/config";
import { loadWorkspaceSummary } from "@/lib/workspace/summary";

export const runtime = "nodejs";

function configurationError() {
  const env = getDatabaseEnv();

  if (env.ok) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "workspace_summary_configuration_error",
        message: `${env.message} Workspace summary requires DATABASE_URL.`,
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
        code: "workspace_summary_auth_required",
        message: "Connect Spotify before loading the workspace summary.",
      },
    },
    { status: 401 },
  );
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

  const summary = await loadWorkspaceSummary(owner);

  return jsonWithCollectionOwnerCookies(owner, { summary });
}
