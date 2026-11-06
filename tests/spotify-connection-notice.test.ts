import { describe, expect, test } from "vitest";

import { getSpotifyConnectionNotice } from "@/lib/spotify/connection-notice";

describe("Spotify connection notices", () => {
  test("explains a Spotify account owned by another WAXLIST account", () => {
    const notice = getSpotifyConnectionNotice({
      status: "error",
      reason: "claimed_by_another_account",
    });

    expect(notice?.tone).toBe("error");
    expect(notice?.title).toContain("already connected");
    expect(notice?.message).toContain("different WAXLIST account");
    expect(notice?.message).toContain("disconnect Spotify");
    // The hard block offers no retry: reconnecting the same Spotify account
    // would fail identically.
    expect(notice?.action).toBeNull();
  });

  test("offers a reconnect when the current account holds another Spotify link", () => {
    const notice = getSpotifyConnectionNotice({
      status: "error",
      reason: "current_account_linked_elsewhere",
    });

    expect(notice?.tone).toBe("error");
    expect(notice?.action).toBe("connect");
    expect(notice?.message).toContain("Disconnect Spotify");
  });

  test("never reflects an unknown provider reason to the collector", () => {
    const notice = getSpotifyConnectionNotice({
      status: "error",
      reason: "some_raw_spotify_provider_code",
    });

    expect(notice?.tone).toBe("error");
    expect(notice?.title).toBe("Spotify didn't connect");
    expect(JSON.stringify(notice)).not.toContain("some_raw_spotify_provider_code");
  });

  test("still explains a failed connect that arrived without a mapped reason", () => {
    const notice = getSpotifyConnectionNotice({ status: "error" });

    expect(notice?.tone).toBe("error");
    expect(notice?.action).toBe("retry");
    expect(notice?.message).toBeTruthy();
  });

  test("confirms a connection, a release, and a legacy claim", () => {
    expect(
      getSpotifyConnectionNotice({ status: "connected" })?.tone,
    ).toBe("success");
    expect(
      getSpotifyConnectionNotice({ status: "disconnected" })?.tone,
    ).toBe("success");
    expect(
      getSpotifyConnectionNotice({ status: "disconnected" })?.message,
    ).toContain("released");
    expect(getSpotifyConnectionNotice({ status: "claimed" })?.title).toBe(
      "Spotify data claimed",
    );
  });

  test("stays quiet for an ordinary workspace visit", () => {
    expect(getSpotifyConnectionNotice({})).toBeNull();
    expect(
      getSpotifyConnectionNotice({ status: null, reason: null }),
    ).toBeNull();
  });
});
