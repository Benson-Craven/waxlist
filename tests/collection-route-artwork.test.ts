import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseEnv: vi.fn(),
  listCollectionRecords: vi.fn(),
  resolveCollectionOwner: vi.fn(),
  seedCollectionFromWishlist: vi.fn(),
  jsonResponse: vi.fn((payload: Record<string, unknown>, status: number) => ({
    status,
    json: async () => payload,
  })),
}));

vi.mock("@/lib/config", () => ({
  getDatabaseEnv: mocks.getDatabaseEnv,
}));

vi.mock("@/lib/capabilities/response", () => ({
  disabledCapabilityResponse: vi.fn(() => null),
}));

vi.mock("@/lib/collection/server", () => ({
  resolveCollectionOwner: mocks.resolveCollectionOwner,
  listCollectionRecords: mocks.listCollectionRecords,
  seedCollectionFromWishlist: mocks.seedCollectionFromWishlist,
  jsonWithCollectionOwnerCookies: (
    _owner: unknown,
    payload: Record<string, unknown>,
    status = 200,
  ) => mocks.jsonResponse(payload, status),
}));

import { GET } from "@/app/api/collection/route";
import type { NextRequest } from "next/server";

const owner = {
  type: "user" as const,
  userId: "user-1",
  sessionIdHash: null,
};

describe("collection route artwork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseEnv.mockReturnValue({ ok: true });
    mocks.resolveCollectionOwner.mockResolvedValue(owner);
    mocks.listCollectionRecords.mockResolvedValue([]);
  });

  test("requests stored artwork for the owner's own carousel", async () => {
    const records = [
      {
        id: "record-1",
        artist: "Sade",
        title: "Diamond Life",
        imageUrl: "https://img.test/diamond-life.jpg",
        mediaCondition: null,
        priceHintCents: null,
      },
    ];
    mocks.listCollectionRecords.mockResolvedValue(records);

    const response = await GET({} as NextRequest);
    const body = await response.json();

    expect(mocks.listCollectionRecords).toHaveBeenCalledOnce();
    expect(mocks.listCollectionRecords).toHaveBeenCalledWith(owner, {
      keepArtwork: true,
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ records });
  });

  test("does not load records without an authenticated owner", async () => {
    mocks.resolveCollectionOwner.mockResolvedValue(null);

    const response = await GET({} as NextRequest);

    expect(response.status).toBe(401);
    expect(mocks.listCollectionRecords).not.toHaveBeenCalled();
  });

  test("reports a configuration error before touching the collection", async () => {
    mocks.getDatabaseEnv.mockReturnValue({
      ok: false,
      message: "Missing DATABASE_URL.",
      missing: ["DATABASE_URL"],
    });

    const response = await GET({} as NextRequest);

    expect(response.status).toBe(500);
    expect(mocks.listCollectionRecords).not.toHaveBeenCalled();
  });
});
