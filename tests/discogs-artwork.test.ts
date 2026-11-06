import { describe, expect, it } from "vitest";

import {
  discogsArtworkQuality,
  isDiscogsThumbnailUrl,
  pickDiscogsArtworkUrl,
} from "@/lib/discogs/artwork";

const THUMB =
  "https://i.discogs.com/2VisCUsRNFqU9bwFPZ-VgKnXyjV-FU-D5aZZ_SB9bHo/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTM1ODg3/NTIyLTE3NjY1MTEw/NDItMzg2Ny5qcGVn.jpeg";
const LARGE =
  "https://i.discogs.com/rdK0147VJ5svkWRRjDlizblPNYTTLwuWdGcyawJZNNE/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTM1ODg3/NTIyLTE3NjY1MTEw/NDItMzg2Ny5qcGVn.jpeg";
const LARGE_SECONDARY =
  "https://i.discogs.com/giMEQU7yZNCPcnK9IBu6X89E8NPZL7djGmw6bbgqSd4/rs:fit/g:sm/q:90/h:595/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTM1ODg3/NTIyLTE3NjY1MTEw/NDItNzg5MS5qcGVn.jpeg";

describe("Discogs artwork quality", () => {
  it("recognises the 150px thumbnail rendition", () => {
    expect(isDiscogsThumbnailUrl(THUMB)).toBe(true);
    expect(isDiscogsThumbnailUrl(LARGE)).toBe(false);
    expect(
      isDiscogsThumbnailUrl(
        "https://i.discogs.com/a/rs:fit/g:sm/q:40/w:150/h:150/b.jpeg",
      ),
    ).toBe(true);
  });

  it("classifies renditions without claiming other hosts", () => {
    expect(discogsArtworkQuality(LARGE)).toBe("large");
    expect(discogsArtworkQuality(THUMB)).toBe("thumbnail");
    expect(
      discogsArtworkQuality("https://images.example.com/q:40/h:150/w:150/a.jpg"),
    ).toBe("unknown");
    expect(discogsArtworkQuality(null)).toBe("unknown");
  });

  it("rejects non-http values", () => {
    expect(isDiscogsThumbnailUrl("javascript:alert(1)")).toBe(false);
    expect(discogsArtworkQuality("not a url")).toBe("unknown");
  });
});

describe("pickDiscogsArtworkUrl", () => {
  it("prefers the 600px rendition over the 150px thumbnail", () => {
    expect(
      pickDiscogsArtworkUrl([
        { type: "primary", uri: LARGE, uri150: THUMB, resource_url: LARGE },
      ]),
    ).toBe(LARGE);
  });

  it("prefers the primary image over secondary images", () => {
    expect(
      pickDiscogsArtworkUrl([
        { type: "secondary", uri: LARGE_SECONDARY, resource_url: LARGE_SECONDARY },
        { type: "primary", uri: LARGE, resource_url: LARGE },
      ]),
    ).toBe(LARGE);
  });

  it("falls back to the release thumbnail when no image list exists", () => {
    expect(pickDiscogsArtworkUrl([], THUMB)).toBe(THUMB);
    expect(pickDiscogsArtworkUrl(undefined, THUMB)).toBe(THUMB);
  });

  it("returns null when nothing usable is present", () => {
    expect(pickDiscogsArtworkUrl([], null)).toBeNull();
    expect(pickDiscogsArtworkUrl([{ uri: "  " }, null], undefined)).toBeNull();
    expect(pickDiscogsArtworkUrl([], "not-a-url")).toBeNull();
  });

  it("returns the only available thumbnail when that is all there is", () => {
    expect(pickDiscogsArtworkUrl([{ type: "primary", uri150: THUMB }])).toBe(
      THUMB,
    );
  });

  it("deduplicates identical renditions", () => {
    const picked = pickDiscogsArtworkUrl([
      { type: "primary", uri: LARGE, resource_url: LARGE },
      { type: "secondary", uri: LARGE, resource_url: LARGE },
    ]);

    expect(picked).toBe(LARGE);
  });
});
