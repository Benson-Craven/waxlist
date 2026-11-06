export type AuthIntent = "sign-in" | "sign-up";

export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "WAXLIST can't reach sign-in right now. Check your connection and try again.";

const INVALID_CREDENTIALS_MESSAGE =
  "That email and password don't match an account. Try again, or create one.";

const ACCOUNT_EXISTS_MESSAGE =
  "An account with this email already exists. Sign in instead.";

const VERIFY_EMAIL_MESSAGE =
  "Confirm your email address first. The link is in your inbox.";

const WEAK_PASSWORD_MESSAGE =
  "Use at least 8 characters.";

const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a minute, then try again.";

const GENERIC_MESSAGES: Record<AuthIntent, string> = {
  "sign-in": "WAXLIST couldn't sign you in. Try again.",
  "sign-up": "WAXLIST couldn't create your account. Try again.",
};

const SIGN_IN_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: INVALID_CREDENTIALS_MESSAGE,
  invalid_password: INVALID_CREDENTIALS_MESSAGE,
  invalid_email_or_password: INVALID_CREDENTIALS_MESSAGE,
  user_not_found: INVALID_CREDENTIALS_MESSAGE,
  credential_account_not_found: INVALID_CREDENTIALS_MESSAGE,
  identity_not_found: INVALID_CREDENTIALS_MESSAGE,
  email_not_confirmed: VERIFY_EMAIL_MESSAGE,
  email_not_verified: VERIFY_EMAIL_MESSAGE,
  weak_password: WEAK_PASSWORD_MESSAGE,
  password_too_short: WEAK_PASSWORD_MESSAGE,
  invalid_email: INVALID_EMAIL_MESSAGE,
  email_address_invalid: INVALID_EMAIL_MESSAGE,
};

const SIGN_UP_CODE_MESSAGES: Record<string, string> = {
  user_already_exists: ACCOUNT_EXISTS_MESSAGE,
  email_exists: ACCOUNT_EXISTS_MESSAGE,
  weak_password: WEAK_PASSWORD_MESSAGE,
  password_too_short: WEAK_PASSWORD_MESSAGE,
  password_too_long: WEAK_PASSWORD_MESSAGE,
  invalid_email: INVALID_EMAIL_MESSAGE,
  email_address_invalid: INVALID_EMAIL_MESSAGE,
};

const SERVICE_FAILURE_CODES = new Set([
  "unexpected_failure",
  "internal_error",
  "internal_server_error",
  "failed_to_create_user",
  "failed_to_create_session",
  "failed_to_get_session",
  "failed_to_update_user",
]);

const RATE_LIMIT_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
]);

function readErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : {};
}

function readStatusCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{3}$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }

  return null;
}

/**
 * Turns a provider or transport error into copy a collector can act on.
 *
 * Provider messages are never echoed: they are provider-shaped ("Invalid email
 * or password"), can change without notice, and sometimes leak internals.
 */
export function describeAuthError(
  error: unknown,
  intent: AuthIntent,
): string {
  const record = readErrorRecord(error);
  const code =
    typeof record.code === "string" ? record.code.trim().toLowerCase() : "";
  const status = readStatusCode(record.status);

  if (code.startsWith("network_")) return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  if (SERVICE_FAILURE_CODES.has(code)) return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  if (RATE_LIMIT_CODES.has(code)) return RATE_LIMIT_MESSAGE;
  if (status === 429) return RATE_LIMIT_MESSAGE;

  const intentMessages =
    intent === "sign-in" ? SIGN_IN_CODE_MESSAGES : SIGN_UP_CODE_MESSAGES;
  const mappedMessage = intentMessages[code];

  if (mappedMessage) return mappedMessage;

  if (status !== null && status >= 500) {
    return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  }

  return GENERIC_MESSAGES[intent];
}
