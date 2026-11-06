import { getNeonAuthServer } from "@/lib/auth/server";
import { evaluateConfiguredBetaInvite } from "@/lib/auth/invite";

type AuthRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function configurationError() {
  return Response.json(
    {
      error: {
        code: "auth_configuration_error",
        message: "Managed Neon Auth is not configured for this environment.",
      },
    },
    { status: 503 },
  );
}

function inviteRequiredError(mode: "allowlist" | "unconfigured") {
  return Response.json(
    {
      error: {
        code:
          mode === "unconfigured"
            ? "beta_invites_unconfigured"
            : "beta_invite_required",
        message:
          mode === "unconfigured"
            ? "WAXLIST beta invitations are not configured yet."
            : "This email is not on the WAXLIST beta invite list.",
      },
    },
    { status: 403 },
  );
}

async function enforceSignupInvite(
  request: Request,
  context: AuthRouteContext,
) {
  const { path } = await context.params;

  if (path.join("/") !== "sign-up/email") {
    return null;
  }

  const payload = await request
    .clone()
    .json()
    .catch(() => null);
  const email =
    payload &&
    typeof payload === "object" &&
    "email" in payload &&
    typeof payload.email === "string"
      ? payload.email
      : "";
  const invite = evaluateConfiguredBetaInvite(email);

  return invite.allowed ? null : inviteRequiredError(invite.mode);
}

function serviceUnavailableError() {
  return Response.json(
    {
      error: {
        code: "auth_service_unavailable",
        message:
          "WAXLIST sign-in is temporarily unavailable. Try again in a moment.",
      },
    },
    { status: 502 },
  );
}

export async function GET(request: Request, context: AuthRouteContext) {
  const server = getNeonAuthServer();

  if (!server.ok) {
    return configurationError();
  }

  try {
    return await server.auth.handler().GET(request, context);
  } catch {
    console.error("[auth-proxy] GET request failed.");
    return serviceUnavailableError();
  }
}

export async function POST(request: Request, context: AuthRouteContext) {
  const inviteError = await enforceSignupInvite(request, context);

  if (inviteError) {
    return inviteError;
  }

  const server = getNeonAuthServer();

  if (!server.ok) {
    return configurationError();
  }

  try {
    return await server.auth.handler().POST(request, context);
  } catch {
    console.error("[auth-proxy] POST request failed.");
    return serviceUnavailableError();
  }
}
