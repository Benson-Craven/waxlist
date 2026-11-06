import { describe, expect, test } from "vitest";

import { decideLegacyClaim } from "@/lib/auth/legacy-claim";

describe("legacy Spotify data claim", () => {
  test("binds an unclaimed legacy user to the signed-in neutral identity", () => {
    expect(
      decideLegacyClaim({
        currentUserId: "neutral",
        currentSpotifyUserId: null,
        legacyUserId: "legacy",
        legacyAuthUserId: null,
        authUserId: "auth-1",
      }),
    ).toBe("bind_legacy");
  });

  test("is idempotent for the same auth identity", () => {
    expect(
      decideLegacyClaim({
        currentUserId: "neutral",
        currentSpotifyUserId: null,
        legacyUserId: "legacy",
        legacyAuthUserId: "auth-1",
        authUserId: "auth-1",
      }),
    ).toBe("already_claimed");
  });

  test("prevents claiming data already bound to another auth identity", () => {
    expect(
      decideLegacyClaim({
        currentUserId: "neutral",
        currentSpotifyUserId: null,
        legacyUserId: "legacy",
        legacyAuthUserId: "auth-other",
        authUserId: "auth-1",
      }),
    ).toBe("claimed_by_another_account");
  });

  test("does not retain a Spotify identity when no legacy data matches", () => {
    expect(
      decideLegacyClaim({
        currentUserId: "neutral",
        currentSpotifyUserId: null,
        legacyUserId: null,
        legacyAuthUserId: null,
        authUserId: "auth-1",
      }),
    ).toBe("no_matching_legacy");
  });

  test("does not relink a neutral account already tied to another legacy user", () => {
    expect(
      decideLegacyClaim({
        currentUserId: "neutral",
        currentSpotifyUserId: "spotify-existing",
        legacyUserId: "legacy-other",
        legacyAuthUserId: null,
        authUserId: "auth-1",
      }),
    ).toBe("current_account_linked_elsewhere");
  });
});
