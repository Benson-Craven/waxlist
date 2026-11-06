import { describe, expect, test } from "vitest";

import {
  CRATE_SOURCES,
  getCrateHref,
  getCrateSource,
} from "@/lib/listening/sources";

describe("Crate source routing", () => {
  test("defaults to Spotify and emits canonical source URLs", () => {
    expect(getCrateSource(undefined)).toBe("spotify");
    expect(
      CRATE_SOURCES.map((source) => getCrateHref(source)),
    ).toEqual([
      "/app?view=crate&source=spotify",
      "/app?view=crate&source=listenbrainz",
      "/app?view=crate&source=youtube",
    ]);
  });

  test("fails unknown source values back to Spotify", () => {
    expect(getCrateSource("youtube_music")).toBe("spotify");
    expect(getCrateSource(["youtube"])).toBe("youtube");
  });
});
