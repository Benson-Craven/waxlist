import { describe, expect, test } from "vitest";

import {
  getAuthStatusForOwnerFailure,
  getAuthStatusMessage,
} from "@/lib/auth/notices";

describe("auth status notices", () => {
  test("explains a required sign-in", () => {
    expect(getAuthStatusMessage("auth_required")).toMatch(/Sign in/);
  });

  test("reads the first value of a repeated status parameter", () => {
    expect(getAuthStatusMessage(["session_expired", "auth_required"])).toMatch(
      /signed out/i,
    );
  });

  test("ignores unknown or inherited property names", () => {
    expect(getAuthStatusMessage("constructor")).toBeNull();
    expect(getAuthStatusMessage("__proto__")).toBeNull();
    expect(getAuthStatusMessage("something_else")).toBeNull();
    expect(getAuthStatusMessage(undefined)).toBeNull();
    expect(getAuthStatusMessage(42)).toBeNull();
  });

  test("maps owner-resolution failures onto an explainable status", () => {
    expect(getAuthStatusForOwnerFailure("auth_required")).toBe("auth_required");
    expect(getAuthStatusForOwnerFailure("auth_configuration_error")).toBe(
      "configuration_error",
    );
    expect(getAuthStatusForOwnerFailure("auth_session_error")).toBe(
      "service_unavailable",
    );
  });
});
