import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveAuthenticatedOwner: vi.fn(),
  loadPressingCollectionOverlay: vi.fn(),
  resolveCataloguePressing: vi.fn(),
  searchPressingSeeds: vi.fn(),
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
  getSessionSecretEnv: vi.fn(() => ({
    ok: true,
    secret: "0123456789abcdef0123456789abcdef",
    source: "SESSION_SECRET",
  })),
}));

vi.mock("@/lib/pressing-proof/server", () => ({
  loadPressingCollectionOverlay: mocks.loadPressingCollectionOverlay,
  resolveCataloguePressing: mocks.resolveCataloguePressing,
  searchPressingSeeds: mocks.searchPressingSeeds,
}));

import { POST as searchPOST } from "@/app/api/discogs/pressings/search/route";
import { POST as resolvePOST } from "@/app/api/discogs/pressings/resolve/route";

function anonymous() {
  mocks.resolveAuthenticatedOwner.mockResolvedValue({
    ok: false,
    code: "auth_required",
    message: "Sign in.",
    missing: [],
  });
}

function request(
  path: string,
  body: unknown,
  input: { ip: string; cookie?: string },
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": input.ip,
      ...(input.cookie ? { cookie: input.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("pressing catalogue routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAXLIST_ENABLE_PRESSING_PROOF = "true";
    anonymous();
    mocks.loadPressingCollectionOverlay.mockResolvedValue([]);
    mocks.searchPressingSeeds.mockResolvedValue({
      candidates: [
        {
          id: 123,
          masterId: 456,
          title: "The Example Band - Example Album",
          uri: "https://www.discogs.com/release/123",
        },
      ],
      totalItems: 1,
      checkedAt: "2026-07-30T12:00:00.000Z",
      attribution: {
        label: "Catalogue data provided by Discogs",
        url: "https://www.discogs.com",
      },
      rateLimit: { limit: 60, used: 1, remaining: 59 },
    });
    mocks.resolveCataloguePressing.mockResolvedValue({
      masterId: 456,
      familyKey: "master:456",
      seedReleaseId: 123,
      checkedAt: "2026-07-30T12:00:00.000Z",
      attribution: {
        label: "Catalogue data provided by Discogs",
        url: "https://www.discogs.com",
      },
      rateLimit: { limit: 60, used: 2, remaining: 58 },
      resolution: {
        kind: "shortlist",
        reason: "multiple_candidates",
        resolvedReleaseId: null,
        remainingCandidates: [{ id: 123 }, { id: 124 }],
        rejectedCandidates: [],
        nextQuestion: {
          field: "catalogNumber",
          title: "Check the catalogue number",
          description: "Compare the label or spine catalogue number.",
          examples: [],
        },
        comparisonComplete: true,
      },
    });
  });

  test("searches a seed from a manual barcode and returns attribution", async () => {
    const response = await searchPOST(
      request(
        "/api/discogs/pressings/search",
        { barcode: "012345678905", inputSource: "manual_barcode" },
        { ip: "203.0.113.10" },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      search: {
        candidates: [{ id: 123, masterId: 456 }],
        attribution: {
          label: "Catalogue data provided by Discogs",
        },
      },
    });
    expect(mocks.searchPressingSeeds).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          barcode: "012345678905",
        },
      }),
    );
  });

  test("allows iterative checks for one anonymous family and blocks a second family", async () => {
    const firstResponse = await resolvePOST(
      request(
        "/api/discogs/pressings/resolve",
        {
          masterId: 456,
          seedReleaseId: 123,
          evidence: { barcode: "012345678905" },
        },
        { ip: "203.0.113.11" },
      ),
    );
    const previewCookie = firstResponse.headers
      .getSetCookie()
      .find((value) => value.startsWith("waxlist_pressing_preview="));

    expect(firstResponse.status).toBe(200);
    expect(previewCookie).toContain("HttpOnly");

    const secondResponse = await resolvePOST(
      request(
        "/api/discogs/pressings/resolve",
        {
          masterId: 456,
          seedReleaseId: 123,
          evidence: {
            barcode: "012345678905",
            catalogNumber: "ILPS 9103",
          },
        },
        {
          ip: "203.0.113.11",
          cookie: previewCookie?.split(";")[0],
        },
      ),
    );

    expect(secondResponse.status).toBe(200);

    mocks.resolveCataloguePressing.mockResolvedValueOnce({
      ...(await mocks.resolveCataloguePressing.mock.results[0].value),
      masterId: 999,
      familyKey: "master:999",
    });
    const blockedResponse = await resolvePOST(
      request(
        "/api/discogs/pressings/resolve",
        {
          masterId: 999,
          seedReleaseId: 777,
          evidence: { barcode: "999" },
        },
        {
          ip: "203.0.113.11",
          cookie: previewCookie?.split(";")[0],
        },
      ),
    );

    expect(blockedResponse.status).toBe(403);
    expect(mocks.resolveCataloguePressing).toHaveBeenCalledTimes(2);
    await expect(blockedResponse.json()).resolves.toMatchObject({
      error: {
        code: "anonymous_preview_family_limit",
      },
    });
  });

  test("does not set an anonymous preview cookie for an authenticated account", async () => {
    mocks.resolveAuthenticatedOwner.mockResolvedValue({
      ok: true,
      owner: {
        type: "user",
        userId: "user-1",
        authUserId: "auth-1",
        sessionIdHash: null,
      },
      profile: {
        id: "auth-1",
        displayName: "Test user",
        email: "test@example.com",
        imageUrl: null,
      },
    });

    const response = await resolvePOST(
      request(
        "/api/discogs/pressings/resolve",
        {
          masterId: 456,
          evidence: { catalogNumber: "ILPS 9103" },
        },
        { ip: "203.0.113.12" },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
