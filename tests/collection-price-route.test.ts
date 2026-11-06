import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseEnv: vi.fn(),
  resolveCollectionOwner: vi.fn(),
  getCollectionRecordById: vi.fn(),
  recordCollectionPriceSnapshot: vi.fn(),
  loadRecordPriceSummaries: vi.fn(),
  jsonResponse: vi.fn((payload: Record<string, unknown>, status: number) => ({
    status,
    json: async () => payload,
  })),
}));

vi.mock("@/lib/config", () => ({
  getDatabaseEnv: mocks.getDatabaseEnv,
}));

vi.mock("@/lib/collection/server", () => ({
  resolveCollectionOwner: mocks.resolveCollectionOwner,
  getCollectionRecordById: mocks.getCollectionRecordById,
  jsonWithCollectionOwnerCookies: (
    _owner: unknown,
    payload: Record<string, unknown>,
    status = 200,
  ) => mocks.jsonResponse(payload, status),
}));

vi.mock("@/lib/collection/pricing-server", () => ({
  recordCollectionPriceSnapshot: mocks.recordCollectionPriceSnapshot,
  loadRecordPriceSummaries: mocks.loadRecordPriceSummaries,
}));

import { POST } from "@/app/api/collection/[id]/price/route";
import type { NextRequest } from "next/server";

const owner = {
  type: "user" as const,
  userId: "user-1",
  sessionIdHash: null,
};

const record = {
  id: "record-1",
  discogsReleaseId: 100,
  artist: "Sade",
  title: "Diamond Life",
  status: "owned",
};

const pricing = {
  currentCents: 2500,
  currency: "GBP",
  source: "manual",
  observedAt: "2026-11-06T12:00:00.000Z",
  previousCents: 3000,
  changeCents: -500,
  changePercent: -16.67,
};

function request(body: unknown) {
  return {
    json: async () => body,
  } as NextRequest;
}

describe("collection price route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseEnv.mockReturnValue({ ok: true });
    mocks.resolveCollectionOwner.mockResolvedValue(owner);
    mocks.getCollectionRecordById.mockResolvedValue(record);
    mocks.recordCollectionPriceSnapshot.mockResolvedValue({
      id: "snapshot-1",
      ...pricing,
    });
    mocks.loadRecordPriceSummaries.mockResolvedValue(
      new Map([["record-1", pricing]]),
    );
  });

  test("records a manual value for the owner's record", async () => {
    const response = await POST(
      request({ amountCents: 2500, currency: "GBP" }),
      { params: Promise.resolve({ id: "record-1" }) },
    );
    const body = await response.json();

    expect(mocks.getCollectionRecordById).toHaveBeenCalledWith(
      owner,
      "record-1",
    );
    expect(mocks.recordCollectionPriceSnapshot).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        collectionItemId: "record-1",
        discogsReleaseId: 100,
        amountCents: 2500,
        currency: "GBP",
        source: "manual",
      }),
    );
    expect(response.status).toBe(201);
    expect(body).toEqual({ pricing });
  });

  test("rejects an invalid amount before loading the record", async () => {
    const response = await POST(
      request({ amountCents: 0, currency: "GBP" }),
      { params: Promise.resolve({ id: "record-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.resolveCollectionOwner).not.toHaveBeenCalled();
    expect(mocks.recordCollectionPriceSnapshot).not.toHaveBeenCalled();
  });

  test("requires an owner", async () => {
    mocks.resolveCollectionOwner.mockResolvedValue(null);

    const response = await POST(
      request({ amountCents: 2500, currency: "GBP" }),
      { params: Promise.resolve({ id: "record-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.recordCollectionPriceSnapshot).not.toHaveBeenCalled();
  });

  test("returns 404 when the record is not in the owner's collection", async () => {
    mocks.getCollectionRecordById.mockResolvedValue(null);

    const response = await POST(
      request({ amountCents: 2500, currency: "GBP" }),
      { params: Promise.resolve({ id: "record-1" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.recordCollectionPriceSnapshot).not.toHaveBeenCalled();
  });
});
