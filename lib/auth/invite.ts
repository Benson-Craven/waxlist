export function evaluateBetaInvite(input: {
  email: string;
  allowlist: string | undefined;
  production: boolean;
}):
  | { allowed: true; mode: "allowlist" | "local-development" }
  | { allowed: false; mode: "allowlist" | "unconfigured" } {
  const invitedEmails = new Set(
    (input.allowlist ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (invitedEmails.size === 0) {
    return input.production
      ? { allowed: false, mode: "unconfigured" }
      : { allowed: true, mode: "local-development" };
  }

  return invitedEmails.has(input.email.trim().toLowerCase())
    ? { allowed: true, mode: "allowlist" }
    : { allowed: false, mode: "allowlist" };
}

export function evaluateConfiguredBetaInvite(email: string) {
  return evaluateBetaInvite({
    email,
    allowlist: process.env.WAXLIST_BETA_INVITE_EMAILS,
    production: process.env.NODE_ENV === "production",
  });
}
