import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPressingInvestigation: vi.fn(),
  listPressingInvestigations: vi.fn(),
  resolveAuthenticatedOwner: vi.fn(),
  updatePressingInvestigation: vi.fn(),
}));

vi.mock("@/lib/auth/owner", () => ({
  resolveAuthenticatedOwner: mocks.resolveAuthenticatedOwner,
}));

vi.mock("@/lib/config", () => ({
  getApiCacheEnv: vi.fn(() => ({ ok: true, ttlMs: 60_000 })),
  getDiscogsEnv: vi.fn(() => ({
    ok: true,
    token: "discogs-token",
    userAgent: "Waxlist test",
    requestDelayMs: 0,
  })),
  getDiscogsMatchSecurityEnv: vi.fn(() => ({
    ok: true,
    maxBodyBytes: 65_536,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 8,
  })),
}));

vi.mock("@/lib/pressing-proof/investigations-server", () => ({
  createPressingInvestigation: mocks.createPressingInvestigation,
  listPressingInvestigations: mocks.listPressingInvestigations,
  updatePressingInvestigation: mocks.updatePressingInvestigation,
}));

import {
  GET,
  PATCH,
  POST,
} from "@/app/api/pressing-investigations/route";

const owner = {
  type: "user" as const,
  userId: "user-1",
  authUserId: "auth-1",
  sessionIdHash: null,
};

function authenticated() {
  mocks.resolveAuthenticatedOwner.mockResolvedValue({
    ok: true,
    owner,
    profile: {
      id: "auth-1",
      displayName: "Test user",
      email: "test@example.com",
      imageUrl: null,
    },
  });
}

function jsonRequest(method: "POST" | "PATCH", body: unknown) {
  return new Request("http://localhost:3000/api/pressing-investigations", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("authenticated pressing investigations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAXLIST_ENABLE_PRESSING_PROOF = "true";
    authenticated();
    mocks.listPressingInvestigations.mockResolvedValue([]);
    mocks.createPressingInvestigation.mockResolvedValue({
      id: "investigation-1",
      status: "active",
      resolutionKind: "shortlist",
    });
    mocks.updatePressingInvestigation.mockResolvedValue({
      id: "investigation-1",
      status: "dismissed",
      resolutionKind: "shortlist",
    });
  });

  test("requires a signed-in account", async () => {
    mocks.resolveAuthenticatedOwner.mockResolvedValue({
      ok: false,
      code: "auth_required",
      message: "Sign in.",
      missing: [],
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.listPressingInvestigations).not.toHaveBeenCalled();
  });

  test("lists only through the resolved owner boundary", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.listPressingInvestigations).toHaveBeenCalledWith(owner);
  });

  test("revalidates preview evidence while saving it to the current owner", async () => {
    const response = await POST(
      jsonRequest("POST", {
        masterId: 456,
        seedReleaseId: 123,
        inputSource: "manual_barcode",
        evidence: {
          barcode: "012345678905",
          catalogNumber: "ILPS 9103",
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createPressingInvestigation).toHaveBeenCalledWith(
      expect.objectContaining({
        owner,
        masterId: 456,
        seedReleaseId: 123,
        inputSource: "manual_barcode",
        evidence: {
          barcode: "012345678905",
          catalogNumber: "ILPS 9103",
          year: null,
        },
        token: "discogs-token",
      }),
    );
  });

  test("dismisses an investigation through an owner-scoped update", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", {
        id: "investigation-1",
        action: "dismiss",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePressingInvestigation).toHaveBeenCalledWith(
      expect.objectContaining({
        owner,
        id: "investigation-1",
        action: "dismiss",
      }),
    );
  });

  test("returns a structured persistence failure without leaking the raw error", async () => {
    mocks.createPressingInvestigation.mockRejectedValueOnce(
      new Error("database secret detail"),
    );

    const response = await POST(
      jsonRequest("POST", {
        masterId: 456,
        seedReleaseId: 123,
        inputSource: "manual_search",
        evidence: {},
      }),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: {
        code: "pressing_investigation_failed",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("database secret detail");
  });

  test("rate limits authenticated provider revalidation by owner", async () => {
    mocks.resolveAuthenticatedOwner.mockResolvedValue({
      ok: true,
      owner: {
        ...owner,
        userId: "user-rate-limit",
      },
      profile: {
        id: "auth-rate-limit",
        displayName: "Rate test",
        email: "rate@example.com",
        imageUrl: null,
      },
    });

    const responses = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      responses.push(
        await POST(
          jsonRequest("POST", {
            masterId: 456,
            inputSource: "manual_search",
            evidence: {},
          }),
        ),
      );
    }

    expect(responses.slice(0, 8).every(({ status }) => status === 201)).toBe(
      true,
    );
    expect(responses[8].status).toBe(429);
    expect(mocks.createPressingInvestigation).toHaveBeenCalledTimes(8);
  });
});
