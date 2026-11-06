import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AddCollectionRecordError extends Error {
    code: string;
    status: number;
    missing: string[];

    constructor(code: string, message: string, status: number, missing: string[] = []) {
      super(message);
      this.name = "AddCollectionRecordError";
      this.code = code;
      this.status = status;
      this.missing = missing;
    }
  }

  return {
    AddCollectionRecordError,
    addCollectionRecord: vi.fn(),
    deleteCollectionRecord: vi.fn(),
    getDatabaseEnv: vi.fn(),
    resolveCollectionOwner: vi.fn(),
    jsonResponse: vi.fn((payload: Record<string, unknown>, status: number) => ({
      status,
      json: async () => payload,
    })),
  };
});

vi.mock("@/lib/config", () => ({
  getDatabaseEnv: mocks.getDatabaseEnv,
}));

vi.mock("@/lib/capabilities/response", () => ({
  disabledCapabilityResponse: vi.fn(() => null),
}));

vi.mock("@/lib/collection/add", () => ({
  AddCollectionRecordError: mocks.AddCollectionRecordError,
  addCollectionRecord: mocks.addCollectionRecord,
}));

vi.mock("@/lib/collection/server", () => ({
  resolveCollectionOwner: mocks.resolveCollectionOwner,
  listCollectionRecords: vi.fn(),
  seedCollectionFromWishlist: vi.fn(),
  collectionRecordForOwner: (record: unknown) => record,
  deleteCollectionRecord: mocks.deleteCollectionRecord,
  updateCollectionRecord: vi.fn(),
  jsonWithCollectionOwnerCookies: (
    _owner: unknown,
    payload: Record<string, unknown>,
    status = 200,
  ) => mocks.jsonResponse(payload, status),
}));

import { POST } from "@/app/api/collection/route";
import { DELETE } from "@/app/api/collection/[id]/route";
import type { NextRequest } from "next/server";

const owner = {
  type: "user" as const,
  userId: "user-1",
  sessionIdHash: null,
};

const savedRecord = {
  id: "record-1",
  artist: "Sade",
  title: "Diamond Life",
  discogsReleaseId: 12345,
  status: "owned",
  favourite: false,
};

function request(body: unknown) {
  return {
    json: async () => body,
  } as NextRequest;
}

describe("collection add and delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseEnv.mockReturnValue({ ok: true });
    mocks.resolveCollectionOwner.mockResolvedValue(owner);
    mocks.addCollectionRecord.mockResolvedValue({
      record: savedRecord,
      existed: false,
    });
    mocks.deleteCollectionRecord.mockResolvedValue(true);
  });

  test("adds a native collection record without restricted data", async () => {
    const response = await POST(
      request({ discogsReleaseId: 12345, status: "owned" }),
    );
    const body = await response.json();

    expect(mocks.addCollectionRecord).toHaveBeenCalledWith(owner, {
      discogsReleaseId: 12345,
      status: "owned",
      favourite: undefined,
    });
    expect(response.status).toBe(201);
    expect(body).toEqual({ record: savedRecord, existed: false });
  });

  test("keeps the wishlist seed path behind the restricted capability", async () => {
    const response = await POST(request({ source: "wishlist" }));

    expect(mocks.addCollectionRecord).not.toHaveBeenCalled();
    expect(response.status).toBe(201);
  });

  test("reports an add failure with its status", async () => {
    mocks.addCollectionRecord.mockRejectedValue(
      new mocks.AddCollectionRecordError(
        "collection_add_release_unavailable",
        "That release could not be loaded from Discogs.",
        502,
      ),
    );

    const response = await POST(
      request({ discogsReleaseId: 12345, status: "owned" }),
    );

    expect(response.status).toBe(502);
  });

  test("requires an owner before adding", async () => {
    mocks.resolveCollectionOwner.mockResolvedValue(null);

    const response = await POST(
      request({ discogsReleaseId: 12345, status: "owned" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.addCollectionRecord).not.toHaveBeenCalled();
  });

  test("deletes one owner-scoped record", async () => {
    const response = await DELETE(request({}), {
      params: Promise.resolve({ id: "record-1" }),
    });

    expect(mocks.deleteCollectionRecord).toHaveBeenCalledWith(owner, "record-1");
    expect(response.status).toBe(200);
  });

  test("returns 404 when deleting a record that is not there", async () => {
    mocks.deleteCollectionRecord.mockResolvedValue(false);

    const response = await DELETE(request({}), {
      params: Promise.resolve({ id: "record-1" }),
    });

    expect(response.status).toBe(404);
  });
});
