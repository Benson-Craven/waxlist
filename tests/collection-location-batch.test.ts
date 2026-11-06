import { describe, expect, test } from "vitest";

import {
  MAX_BULK_LOCATION_RECORDS,
  normalizeBulkLocationRequest,
} from "@/lib/collection/location-batch";

const RECORD_ID = "8f14e45f-ceea-467a-9f0b-4b0f0f0f0f0f";
const OTHER_RECORD_ID = "3c59dc04-8e59-4b6e-9d5f-2a4b6c8d0e1f";

describe("normalizeBulkLocationRequest", () => {
  test("trims, deduplicates, and clears empty fields", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID, ` ${RECORD_ID} `, OTHER_RECORD_ID],
      location: {
        group: " Music group ",
        unit: "Kallax",
        shelf: "",
        slot: "03",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ids: [RECORD_ID, OTHER_RECORD_ID],
        location: {
          group: "Music group",
          unit: "Kallax",
          shelf: null,
          slot: "03",
        },
        mode: "replace",
      },
    });
  });

  test("group mode only moves the group and preserves shelf detail", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID],
      location: {
        group: " Music group ",
        unit: "Kallax",
        shelf: "A",
        slot: "03",
      },
      mode: "group",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ids: [RECORD_ID],
        location: {
          group: "Music group",
          unit: null,
          shelf: null,
          slot: null,
        },
        mode: "group",
      },
    });
  });

  test("group mode requires a group name", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID],
      location: { group: "  " },
      mode: "group",
    });

    expect(result.ok).toBe(false);
  });

  test("ungroup mode clears the group and its shelf detail", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID, OTHER_RECORD_ID],
      mode: "ungroup",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ids: [RECORD_ID, OTHER_RECORD_ID],
        location: {
          group: null,
          unit: null,
          shelf: null,
          slot: null,
        },
        mode: "ungroup",
      },
    });
  });

  test("ungroup mode ignores a location payload", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID],
      location: { group: "Music group", unit: "Kallax" },
      mode: "ungroup",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.location).toEqual({
        group: null,
        unit: null,
        shelf: null,
        slot: null,
      });
    }
  });

  test("rejects an unknown mode", () => {
    expect(
      normalizeBulkLocationRequest({
        ids: [RECORD_ID],
        location: { group: "Music group" },
        mode: "delete",
      }).ok,
    ).toBe(false);
  });

  test("treats omitted fields as cleared", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID],
      location: { shelf: "A" },
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.location).toEqual({
        group: null,
        unit: null,
        shelf: "A",
        slot: null,
      });
    }
  });

  test("rejects an all-empty location", () => {
    const result = normalizeBulkLocationRequest({
      ids: [RECORD_ID],
      location: { group: "", unit: " ", shelf: "", slot: "" },
    });

    expect(result.ok).toBe(false);
  });

  test("rejects an empty or non-uuid selection", () => {
    expect(
      normalizeBulkLocationRequest({
        ids: [],
        location: { shelf: "A" },
      }).ok,
    ).toBe(false);

    expect(
      normalizeBulkLocationRequest({
        ids: ["not-a-record"],
        location: { shelf: "A" },
      }).ok,
    ).toBe(false);
  });

  test("caps the batch size", () => {
    const result = normalizeBulkLocationRequest({
      ids: Array.from(
        { length: MAX_BULK_LOCATION_RECORDS + 1 },
        (_, index) =>
          `8f14e45f-ceea-467a-9f0b-${String(index).padStart(12, "0")}`,
      ),
      location: { shelf: "A" },
    });

    expect(result.ok).toBe(false);
  });

  test("rejects overlong fields and non-text values", () => {
    expect(
      normalizeBulkLocationRequest({
        ids: [RECORD_ID],
        location: { shelf: "A".repeat(81) },
      }).ok,
    ).toBe(false);

    expect(
      normalizeBulkLocationRequest({
        ids: [RECORD_ID],
        location: { shelf: 3 },
      }).ok,
    ).toBe(false);
  });
});
