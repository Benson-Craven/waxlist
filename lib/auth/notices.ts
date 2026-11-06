const AUTH_STATUS_MESSAGES = {
  auth_required: "Sign in to open your workspace.",
  configuration_error:
    "Sign-in isn't set up yet. Ask the beta owner to finish it.",
  service_unavailable:
    "Sign-in didn't complete. Try again in a moment.",
  session_expired:
    "You've been signed out. Sign in to pick up where you left off.",
  verify_email:
    "Check your inbox to confirm your email, then sign in.",
  invite_required:
    "WAXLIST is invite-only. Use the email that got the invite.",
} as const;

export type AuthStatus = keyof typeof AUTH_STATUS_MESSAGES;

function hasAuthStatus(value: string): value is AuthStatus {
  return Object.prototype.hasOwnProperty.call(AUTH_STATUS_MESSAGES, value);
}

export function getAuthStatusMessage(value: unknown): string | null {
  const status = Array.isArray(value) ? value[0] : value;

  return typeof status === "string" && hasAuthStatus(status)
    ? AUTH_STATUS_MESSAGES[status]
    : null;
}

/**
 * Maps an owner-resolution failure onto the message the sign-in surface can
 * explain, so `/app` never dead-ends on a bare form with no context.
 */
export function getAuthStatusForOwnerFailure(
  code: "auth_configuration_error" | "auth_session_error" | "auth_required",
): AuthStatus {
  if (code === "auth_configuration_error") return "configuration_error";
  if (code === "auth_session_error") return "service_unavailable";

  return "auth_required";
}
