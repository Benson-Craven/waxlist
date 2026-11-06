import { afterEach, describe, expect, test, vi } from "vitest";

import {
  MATCH_CORRECTIONS_STORAGE_KEY,
  addMatchCorrection,
  discogsSearchHref,
  isMatchCorrected,
  loadMatchCorrections,
  matchCorrectionKey,
  normalizeMatchCorrections,
  removeMatchCorrection,
  type MatchCorrection,
} from "@/lib/matching/match-corrections";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const CORRECTION: MatchCorrection = {
  sourceKey: "spotify-album-1",
  discogsReleaseId: 1234,
  sourceArtist: "Alice Coltrane",
  sourceAlbum: "Journey in Satchidananda",
  discogsTitle: "Journey in Satchidananda",
  createdAt: "2026-11-06T20:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("match corrections", () => {
  test("keys are stable and release-specific", () => {
    expect(matchCorrectionKey("album", 1)).toBe("album::1");
    expect(matchCorrectionKey("album", 1)).not.toBe(
      matchCorrectionKey("album", 2),
    );
  });

  test("normalization drops malformed entries and duplicates", () => {
    const normalized = normalizeMatchCorrections([
      CORRECTION,
      { ...CORRECTION },
      { ...CORRECTION, discogsReleaseId: "1234" },
      { ...CORRECTION, sourceKey: "" },
      null,
    ]);

    expect(normalized).toEqual([CORRECTION]);
  });

  test("isMatchCorrected only matches the corrected release", () => {
    expect(isMatchCorrected([CORRECTION], "spotify-album-1", 1234)).toBe(true);
    expect(isMatchCorrected([CORRECTION], "spotify-album-1", 5678)).toBe(
      false,
    );
    expect(isMatchCorrected([CORRECTION], "spotify-album-2", 1234)).toBe(
      false,
    );
  });

  test("add, load, and remove round-trip through storage", () => {
    vi.stubGlobal("window", {
      localStorage: createMemoryStorage(),
      dispatchEvent: () => true,
    });

    const afterAdd = addMatchCorrection(CORRECTION);
    expect(afterAdd).toHaveLength(1);
    expect(loadMatchCorrections()).toEqual([CORRECTION]);

    const deduped = addMatchCorrection(CORRECTION);
    expect(deduped).toHaveLength(1);

    const afterRemove = removeMatchCorrection("spotify-album-1", 1234);
    expect(afterRemove).toHaveLength(0);
    expect(loadMatchCorrections()).toHaveLength(0);
  });

  test("a corrupt payload degrades to an empty list", () => {
    const storage = createMemoryStorage();
    storage.setItem(MATCH_CORRECTIONS_STORAGE_KEY, "{not json");
    vi.stubGlobal("window", {
      localStorage: storage,
      dispatchEvent: () => true,
    });

    expect(loadMatchCorrections()).toEqual([]);
  });

  test("search handoff points at vinyl releases", () => {
    const href = discogsSearchHref(CORRECTION);

    expect(href).toContain("https://www.discogs.com/search/");
    expect(href).toContain("format=Vinyl");
    expect(href).toContain(
      encodeURIComponent("Alice Coltrane Journey in Satchidananda"),
    );
  });
});
