"use server";

import { redirect } from "next/navigation";

import {
  AUTH_SERVICE_UNAVAILABLE_MESSAGE,
  describeAuthError,
} from "@/lib/auth/error-messages";
import { evaluateConfiguredBetaInvite } from "@/lib/auth/invite";
import { buildSignInHref, getSafeNextPath } from "@/lib/auth/redirects";
import { getNeonAuthServer } from "@/lib/auth/server";
import {
  getCrateHref,
  getCrateSource,
  type CrateSource,
} from "@/lib/listening/sources";

export type AuthActionState = {
  error: string;
} | null;

const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readField(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" ? value : "";
}

function resolveSignInDestination(formData: FormData, source: CrateSource) {
  return getSafeNextPath(readField(formData, "next"), getCrateHref(source));
}

function getValidatedEmail(formData: FormData) {
  return readField(formData, "email").trim().toLowerCase();
}

export async function signUpWithEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const auth = getNeonAuthServer();

  if (!auth.ok) {
    return {
      error: auth.error.message,
    };
  }

  const name = readField(formData, "name").trim();
  const email = getValidatedEmail(formData);
  // Passwords are intentionally not trimmed: leading or trailing spaces are
  // part of what the collector typed, and trimming would silently change it.
  const password = readField(formData, "password");
  const source = getCrateSource(readField(formData, "source"));

  if (!name) {
    return { error: "Add your name so WAXLIST can label your crate." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const invite = evaluateConfiguredBetaInvite(email);

  if (!invite.allowed) {
    return {
      error:
        invite.mode === "unconfigured"
          ? "WAXLIST beta invitations are not configured yet."
          : "This email is not on the WAXLIST beta invite list.",
    };
  }

  let result: Awaited<ReturnType<typeof auth.auth.signUp.email>>;

  try {
    result = await auth.auth.signUp.email({
      name,
      email,
      password,
    });
  } catch {
    return { error: AUTH_SERVICE_UNAVAILABLE_MESSAGE };
  }

  if (result.error) {
    return { error: describeAuthError(result.error, "sign-up") };
  }

  const destination = resolveSignInDestination(formData, source);

  if (!result.data?.token) {
    // The account exists but no session was issued, which means the provider
    // wants the address confirmed first. Say so instead of bouncing the user
    // back to a blank sign-in form.
    redirect(
      buildSignInHref({
        next: destination,
        source,
        status: "verify_email",
      }),
    );
  }

  redirect(destination);
}

export async function signInWithEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const auth = getNeonAuthServer();

  if (!auth.ok) {
    return {
      error: auth.error.message,
    };
  }

  const email = getValidatedEmail(formData);
  const password = readField(formData, "password");
  const source = getCrateSource(readField(formData, "source"));

  if (!email || !password) {
    return { error: "Enter your email and password to continue." };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  let result: Awaited<ReturnType<typeof auth.auth.signIn.email>>;

  try {
    result = await auth.auth.signIn.email({
      email,
      password,
    });
  } catch {
    return { error: AUTH_SERVICE_UNAVAILABLE_MESSAGE };
  }

  if (result.error) {
    return { error: describeAuthError(result.error, "sign-in") };
  }

  redirect(resolveSignInDestination(formData, source));
}
