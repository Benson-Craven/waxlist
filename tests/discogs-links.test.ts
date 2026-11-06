import { describe, expect, it } from "vitest";

import {
  discogsReleaseUrl,
  discogsSellReleaseUrl,
} from "@/lib/discogs/links";

describe("discogs links", () => {
  it("points at the catalogue page and the marketplace page", () => {
    expect(discogsReleaseUrl(9169243)).toBe(
      "https://www.discogs.com/release/9169243",
    );
    expect(discogsSellReleaseUrl(9169243)).toBe(
      "https://www.discogs.com/sell/release/9169243",
    );
  });
});
