import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseEnv: vi.fn(),
  disabledCapabilityResponse: vi.fn(),
  resolveCollectionOwner: vi.fn(),
  getCollectionRecordById: vi.fn(),
  fetchDiscogsPriceForRecord: vi.fn(),
  loadRecordPriceSummaries: vi.fn(),
  jsonResponse: vi.fn((payload: Record<string, unknown>, status: number) => ({
    status,
    json: async () => payload,
  })),
}));

vi.mock("@/lib/config", () => ({
  getDatabaseEnv: mocks.getDatabaseEnv,
}));

vi.mock("@/lib/capabilities/response", () => ({
  disabledCapabilityResponse: mocks.disabledCapabilityResponse,
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
  fetchDiscogsPriceForRecord: mocks.fetchDiscogsPriceForRecord,
  loadRecordPriceSummaries: mocks.loadRecordPriceSummaries,
}));

import { POST } from "@/app/api/collection/[id]/price/discogs/route";
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
  currentCents: 2515,
  currency: "GBP",
  source: "discogs_marketplace",
  observedAt: "2026-11-06T12:00:00.000Z",
  previousCents: null,
  changeCents: null,
  changePercent: null,
};

function request() {
  return {} as NextRequest;
}

describe("Discogs price route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseEnv.mockReturnValue({ ok: true });
    mocks.disabledCapabilityResponse.mockReturnValue(null);
    mocks.resolveCollectionOwner.mockResolvedValue(owner);
    mocks.getCollectionRecordById.mockResolvedValue(record);
    mocks.loadRecordPriceSummaries.mockResolvedValue(new Map());
    mocks.fetchDiscogsPriceForRecord.mockResolvedValue({
      ok: true,
      pricing,
      numForSale: 30,
    });
  });

  test("returns a stored Discogs price for the owner's record", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "record-1" }),
    });
    const body = await response.json();

    expect(mocks.fetchDiscogsPriceForRecord).toHaveBeenCalledWith(owner, {
      ...record,
      pricing: null,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ pricing, numForSale: 30 });
  });

  test("stays behind the marketplace capability", async () => {
    mocks.disabledCapabilityResponse.mockReturnValue({
      status: 404,
      json: async () => ({ error: { code: "capability_disabled" } }),
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "record-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.resolveCollectionOwner).not.toHaveBeenCalled();
  });

  test("reports a missing marketplace price", async () => {
    mocks.fetchDiscogsPriceForRecord.mockResolvedValue({
      ok: false,
      code: "discogs_no_price",
      message: "Discogs has no marketplace listing price for this release right now.",
      status: 404,
      retryAfterSeconds: null,
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "record-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.message).toContain("no marketplace listing price");
  });

  test("reports rate limiting with its retry window", async () => {
    mocks.fetchDiscogsPriceForRecord.mockResolvedValue({
      ok: false,
      code: "discogs_rate_limited",
      message: "Discogs is rate limiting requests.",
      status: 429,
      retryAfterSeconds: 30,
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "record-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.retryAfterSeconds).toBe(30);
  });
});
