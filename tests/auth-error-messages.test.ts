import { describe, expect, test } from "vitest";

import {
  AUTH_SERVICE_UNAVAILABLE_MESSAGE,
  describeAuthError,
} from "@/lib/auth/error-messages";

describe("auth error messages", () => {
  test("explains wrong credentials without echoing the provider", () => {
    const message = describeAuthError(
      {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
        status: 401,
      },
      "sign-in",
    );

    expect(message).toMatch(/don't match/);
    expect(message).not.toContain("Invalid email or password");
  });

  test("treats an unknown account as wrong credentials", () => {
    expect(
      describeAuthError({ code: "user_not_found", status: 404 }, "sign-in"),
    ).toMatch(/don't match/);
  });

  test("points an existing account at sign-in", () => {
    expect(
      describeAuthError({ code: "USER_ALREADY_EXISTS", status: 409 }, "sign-up"),
    ).toMatch(/already exists.*Sign in instead/);
  });

  test("explains an unconfirmed email address", () => {
    expect(
      describeAuthError({ code: "email_not_confirmed", status: 403 }, "sign-in"),
    ).toMatch(/Confirm your email address/);
  });

  test("explains a weak password on sign-up", () => {
    expect(
      describeAuthError({ code: "PASSWORD_TOO_SHORT", status: 400 }, "sign-up"),
    ).toMatch(/at least 8 characters/);
  });

  test("explains rate limiting by code or status", () => {
    expect(
      describeAuthError(
        { code: "over_request_rate_limit", status: 429 },
        "sign-in",
      ),
    ).toMatch(/Too many attempts/);
    expect(describeAuthError({ status: 429 }, "sign-up")).toMatch(
      /Too many attempts/,
    );
  });

  test("reports an unreachable service for transport and 5xx failures", () => {
    expect(
      describeAuthError({ code: "NETWORK_REFUSED", status: 502 }, "sign-in"),
    ).toBe(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
    expect(
      describeAuthError({ code: "unexpected_failure", status: 500 }, "sign-up"),
    ).toBe(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
    expect(describeAuthError({ status: 503 }, "sign-in")).toBe(
      AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    );
  });

  test("falls back to intent-specific copy", () => {
    expect(describeAuthError(null, "sign-in")).toMatch(/couldn't sign you in/);
    expect(describeAuthError({}, "sign-up")).toMatch(/couldn't create/);
    expect(
      describeAuthError(
        { message: "SQLITE_CONSTRAINT: users.email" },
        "sign-up",
      ),
    ).not.toContain("SQLITE_CONSTRAINT");
  });
});
