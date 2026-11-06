import { describe, expect, test } from "vitest";

import type { CollectionRecord } from "@/lib/collection/record";
import {
  SPIN_NOTE_MAX_LENGTH,
  buildSpinStats,
  buildSpinSuggestions,
  formatSpinDayLabel,
  groupSpinsByDay,
  normalizeSpinLogInput,
  normalizeSpinNote,
  normalizeSpinSide,
  type SpinLogEntry,
} from "@/lib/spins/record";

const RECORD_ID = "8f14e45f-ceea-467a-9f0b-4b0f0f0f0f0f";
const OTHER_RECORD_ID = "3c59dc04-8e59-4b6e-9d5f-2a4b6c8d0e1f";
const NOW = new Date("2026-11-06T12:00:00.000Z");

function record(overrides: Partial<CollectionRecord> = {}): CollectionRecord {
  return {
    id: RECORD_ID,
    userId: "user-1",
    discogsReleaseId: 100,
    discogsMasterId: null,
    discogsInstanceId: null,
    discogsFolderId: null,
    artist: "Sade",
    title: "Diamond Life",
    format: ["Vinyl", "LP"],
    year: 1984,
    label: "Epic",
    catalogNumber: "EPC 26044",
    barcode: null,
    imageUrl: null,
    mediaCondition: null,
    sleeveCondition: null,
    rating: null,
    favourite: false,
    status: "owned",
    tags: [],
    notes: null,
    group: "Music group",
    unit: "Kallax",
    shelf: "A",
    slot: "01",
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: "2026-07-01T10:00:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function spin(
  id: string,
  spunAt: string,
  collectionItemId = RECORD_ID,
): SpinLogEntry {
  return {
    id,
    collectionItemId,
    spunAt,
    side: null,
    note: null,
    createdAt: spunAt,
    updatedAt: spunAt,
  };
}

describe("spin log input", () => {
  test("accepts a minimal entry and defaults the time to now", () => {
    const result = normalizeSpinLogInput(
      { collectionItemId: RECORD_ID },
      NOW,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toEqual({
        collectionItemId: RECORD_ID,
        spunAt: NOW,
        side: null,
        note: null,
      });
    }
  });

  test("normalizes sides and clears full-album values", () => {
    expect(normalizeSpinSide("side b")).toBe("B");
    expect(normalizeSpinSide("A")).toBe("A");
    expect(normalizeSpinSide("full")).toBeNull();
    expect(normalizeSpinSide("")).toBeNull();
    expect(normalizeSpinSide("Z")).toBeUndefined();
    expect(normalizeSpinSide(3)).toBeUndefined();
  });

  test("trims notes and rejects overlong or non-text notes", () => {
    expect(normalizeSpinNote("  Sunday morning  ")).toBe("Sunday morning");
    expect(normalizeSpinNote("   ")).toBeNull();
    expect(normalizeSpinNote(null)).toBeNull();
    expect(normalizeSpinNote(3)).toBeUndefined();

    const result = normalizeSpinLogInput(
      {
        collectionItemId: RECORD_ID,
        note: "x".repeat(SPIN_NOTE_MAX_LENGTH + 1),
      },
      NOW,
    );

    expect(result.ok).toBe(false);
  });

  test("accepts past times but rejects future and invalid times", () => {
    const past = normalizeSpinLogInput(
      {
        collectionItemId: RECORD_ID,
        spunAt: "2026-11-01T20:00:00.000Z",
      },
      NOW,
    );
    const future = normalizeSpinLogInput(
      {
        collectionItemId: RECORD_ID,
        spunAt: "2026-11-07T20:00:00.000Z",
      },
      NOW,
    );
    const invalid = normalizeSpinLogInput(
      {
        collectionItemId: RECORD_ID,
        spunAt: "not-a-date",
      },
      NOW,
    );

    expect(past.ok).toBe(true);
    expect(future.ok).toBe(false);
    expect(invalid.ok).toBe(false);
  });

  test("rejects a missing or non-uuid collection record", () => {
    expect(normalizeSpinLogInput({}, NOW).ok).toBe(false);
    expect(
      normalizeSpinLogInput({ collectionItemId: "record-1" }, NOW).ok,
    ).toBe(false);
  });
});

describe("spin log stats", () => {
  test("counts the week, unique records, last spin, and a current streak", () => {
    const stats = buildSpinStats(
      [
        spin("1", "2026-11-06T09:00:00.000Z"),
        spin("2", "2026-11-06T07:00:00.000Z", OTHER_RECORD_ID),
        spin("3", "2026-11-05T12:00:00.000Z"),
        spin("4", "2026-11-03T12:00:00.000Z", OTHER_RECORD_ID),
        spin("5", "2026-10-28T12:00:00.000Z"),
      ],
      NOW,
    );

    expect(stats.totalSpins).toBe(5);
    expect(stats.spinsLast7Days).toBe(4);
    expect(stats.uniqueRecords).toBe(2);
    expect(stats.currentStreakDays).toBe(2);
    expect(stats.lastSpinAt).toBe("2026-11-06T09:00:00.000Z");
  });

  test("keeps a streak alive when the last spin was yesterday", () => {
    const stats = buildSpinStats(
      [
        spin("1", "2026-11-05T12:00:00.000Z"),
        spin("2", "2026-11-04T12:00:00.000Z"),
        spin("3", "2026-11-03T12:00:00.000Z"),
      ],
      NOW,
    );

    expect(stats.currentStreakDays).toBe(3);
  });

  test("reports no streak after a missed day", () => {
    const stats = buildSpinStats(
      [spin("1", "2026-11-03T12:00:00.000Z")],
      NOW,
    );

    expect(stats.currentStreakDays).toBe(0);
    expect(stats.spinsLast7Days).toBe(1);
  });

  test("returns zeroed stats for an empty log", () => {
    expect(buildSpinStats([], NOW)).toEqual({
      totalSpins: 0,
      spinsLast7Days: 0,
      uniqueRecords: 0,
      currentStreakDays: 0,
      lastSpinAt: null,
    });
  });
});

describe("spin timeline grouping", () => {
  test("groups newest first and labels today and yesterday", () => {
    const groups = groupSpinsByDay(
      [
        spin("1", "2026-11-06T09:00:00.000Z"),
        spin("2", "2026-11-05T12:00:00.000Z"),
        spin("3", "2026-11-04T12:00:00.000Z"),
      ],
      NOW,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Wednesday 4 November",
    ]);
    expect(groups[0].spins).toHaveLength(1);
    expect(formatSpinDayLabel("2026-11-06", NOW)).toBe("Today");
  });

  test("keeps entries on the same local day together", () => {
    const groups = groupSpinsByDay(
      [
        spin("1", "2026-11-06T09:00:00.000Z"),
        spin("2", "2026-11-06T07:00:00.000Z"),
      ],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].spins.map((entry) => entry.id)).toEqual(["1", "2"]);
  });
});

describe("spin suggestions", () => {
  test("prefers never-spun owned records, then the longest unspun", () => {
    const suggestions = buildSpinSuggestions(
      [
        record({ id: RECORD_ID, artist: "A", title: "Never" }),
        record({
          id: OTHER_RECORD_ID,
          artist: "B",
          title: "Long ago",
          discogsReleaseId: 200,
        }),
        record({
          id: "d0f1b4a2-9c83-4e7a-9e1a-2b6c8d0e1f22",
          artist: "C",
          title: "Recent",
          discogsReleaseId: 300,
        }),
        record({
          id: "ae1a2b6c-8d0e-4f22-9c83-4e7a9e1a2b6c",
          artist: "D",
          title: "Wanted",
          discogsReleaseId: 400,
          status: "wanted",
        }),
      ],
      [
        spin("1", "2026-10-27T12:00:00.000Z", OTHER_RECORD_ID),
        spin("2", "2026-11-05T12:00:00.000Z", "d0f1b4a2-9c83-4e7a-9e1a-2b6c8d0e1f22"),
      ],
      { now: NOW },
    );

    expect(suggestions.map((suggestion) => suggestion.record.id)).toEqual([
      RECORD_ID,
      OTHER_RECORD_ID,
    ]);
    expect(suggestions[0].reason).toBe("never");
    expect(suggestions[1].reason).toBe("due");
    expect(suggestions[1].daysSinceLastSpin).toBe(10);
  });

  test("caps the suggestion list", () => {
    const suggestions = buildSpinSuggestions(
      [
        record({ id: RECORD_ID }),
        record({ id: OTHER_RECORD_ID, discogsReleaseId: 200 }),
        record({
          id: "d0f1b4a2-9c83-4e7a-9e1a-2b6c8d0e1f22",
          discogsReleaseId: 300,
        }),
      ],
      [],
      { now: NOW, limit: 2 },
    );

    expect(suggestions).toHaveLength(2);
  });
});
