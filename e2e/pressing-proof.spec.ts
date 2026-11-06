import { expect, test } from "@playwright/test";

const candidates = [
  {
    id: 123,
    masterId: 456,
    title: "The Example Band - Example Album",
    artist: "The Example Band",
    country: "UK",
    year: 1979,
    formats: ["Vinyl", "LP"],
    labels: ["Island Records"],
    catalogNumbers: ["ILPS 9103"],
    barcodes: ["012345678905"],
    matrixRunouts: ["A-3U"],
    pressingPlants: [],
    masteringCredits: [],
    identifiers: [],
    uri: "https://www.discogs.com/release/123",
    detailLoaded: true,
    matchedEvidence: ["Exact barcode match."],
    conflictingEvidence: [],
    unavailableEvidence: [],
  },
  {
    id: 124,
    masterId: 456,
    title: "The Example Band - Example Album",
    artist: "The Example Band",
    country: "US",
    year: 1980,
    formats: ["Vinyl", "LP"],
    labels: ["Island Records"],
    catalogNumbers: ["ILPS 9103-A"],
    barcodes: ["012345678905"],
    matrixRunouts: ["A-5"],
    pressingPlants: [],
    masteringCredits: [],
    identifiers: [],
    uri: "https://www.discogs.com/release/124",
    detailLoaded: true,
    matchedEvidence: ["Exact barcode match."],
    conflictingEvidence: [],
    unavailableEvidence: [],
  },
];

test.describe("pressing-proof beta", () => {
  test("narrows a shared barcode to an exact result without confidence percentages", async ({
    page,
  }) => {
    await page.route("**/api/discogs/pressings/search", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          search: {
            candidates: [
              {
                id: 123,
                masterId: 456,
                title: "The Example Band - Example Album",
                year: 1979,
                formats: ["Vinyl", "LP"],
                country: "UK",
                labels: ["Island Records"],
                catalogNumbers: ["ILPS 9103"],
                barcodes: ["012345678905"],
                uri: "https://www.discogs.com/release/123",
              },
            ],
            totalItems: 1,
            checkedAt: "2026-07-30T12:00:00.000Z",
            attribution: {
              label: "Catalogue data provided by Discogs",
              url: "https://www.discogs.com",
            },
          },
        }),
      });
    });
    await page.route("**/api/discogs/pressings/resolve", async (route) => {
      const request = route.request().postDataJSON() as {
        evidence?: { catalogNumber?: string };
      };
      const exact = request.evidence?.catalogNumber === "ILPS 9103";

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          investigation: {
            authenticated: false,
            previewId: "preview-1",
          },
          masterId: 456,
          seedReleaseId: 123,
          checkedAt: "2026-07-30T12:00:00.000Z",
          attribution: {
            label: "Catalogue data provided by Discogs",
            url: "https://www.discogs.com",
          },
          collectionOverlay: [],
          resolution: exact
            ? {
                kind: "exact",
                reason: "unique_supported_candidate",
                resolvedReleaseId: 123,
                remainingCandidates: [
                  {
                    ...candidates[0],
                    matchedEvidence: [
                      "Exact barcode match.",
                      "Exact catalogue number match.",
                    ],
                  },
                ],
                rejectedCandidates: [candidates[1]],
                nextQuestion: null,
                comparisonComplete: true,
              }
            : {
                kind: "shortlist",
                reason: "multiple_candidates",
                resolvedReleaseId: null,
                remainingCandidates: candidates,
                rejectedCandidates: [],
                nextQuestion: {
                  field: "catalogNumber",
                  title: "Check the catalogue number",
                  description:
                    "Compare the label or spine catalogue number.",
                  examples: [],
                },
                comparisonComplete: true,
              },
        }),
      });
    });

    const response = await page.goto("/identify");
    test.skip(
      response?.status() === 404,
      "Pressing proof is disabled in this server process.",
    );

    await expect(
      page.getByRole("heading", {
        name: "Prove the pressing—do not guess.",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Barcode", exact: true }).click();
    await page.getByLabel("Barcode").fill("012345678905");
    await page.getByRole("button", { name: "Find release family" }).click();
    await page
      .getByRole("button", {
        name: /The Example Band - Example Album/,
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "2 viable versions remain.",
      }),
    ).toBeVisible();
    await expect(page.getByText(/barcode finds a candidate family/i)).toBeVisible();
    await expect(page.getByText(/\d+%/)).toHaveCount(0);

    await page
      .getByLabel("Check the catalogue number")
      .fill("ILPS 9103");
    await page.getByRole("button", { name: "Check evidence" }).click();

    await expect(
      page.getByRole("heading", {
        name: "One version is uniquely supported.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in to save or resume" }),
    ).toBeVisible();
  });

  test("keeps manual entry visible when camera permission is denied and explains offline limits", async ({
    context,
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => [],
          getUserMedia: async () => {
            throw new DOMException("Denied", "NotAllowedError");
          },
        },
      });
    });

    const response = await page.goto("/identify");
    test.skip(
      response?.status() === 404,
      "Pressing proof is disabled in this server process.",
    );

    await page.getByRole("button", { name: "Scan barcode" }).click();
    await expect(
      page.getByText(/Camera permission was denied|manual entry instead/i),
    ).toBeVisible();
    await expect(page.getByLabel("Artist or title")).toBeVisible();

    await context.setOffline(true);
    await expect(
      page.getByText(/current Discogs catalogue searches require a network/i),
    ).toBeVisible();
  });

  test("shows native collection status and saves only after authenticated resolution", async ({
    page,
  }) => {
    const savedRequests: Array<{
      method: string;
      body: Record<string, unknown>;
    }> = [];
    await page.route("**/api/discogs/pressings/search", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          search: {
            candidates: [
              {
                id: 123,
                masterId: 456,
                title: "The Example Band - Example Album",
                year: 1979,
                formats: ["Vinyl", "LP"],
                country: "UK",
                labels: ["Island Records"],
                catalogNumbers: ["ILPS 9103"],
                barcodes: [],
                uri: "https://www.discogs.com/release/123",
              },
            ],
            totalItems: 1,
            checkedAt: "2026-07-30T12:00:00.000Z",
            attribution: {
              label: "Catalogue data provided by Discogs",
              url: "https://www.discogs.com",
            },
          },
        }),
      });
    });
    await page.route("**/api/discogs/pressings/resolve", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          investigation: {
            authenticated: true,
            previewId: null,
          },
          masterId: 456,
          familyKey: "master:456",
          seedReleaseId: 123,
          checkedAt: "2026-07-30T12:00:00.000Z",
          attribution: {
            label: "Catalogue data provided by Discogs",
            url: "https://www.discogs.com",
          },
          collectionOverlay: [
            {
              releaseId: 123,
              owned: true,
              wanted: false,
              duplicateCount: 2,
            },
          ],
          resolution: {
            kind: "unknown",
            reason: "insufficient_evidence",
            resolvedReleaseId: null,
            remainingCandidates: [candidates[0]],
            rejectedCandidates: [],
            nextQuestion: null,
            comparisonComplete: true,
          },
        }),
      });
    });
    await page.route("**/api/pressing-investigations", async (route) => {
      savedRequests.push({
        method: route.request().method(),
        body: route.request().postDataJSON() as Record<string, unknown>,
      });
      await route.fulfill({
        status: route.request().method() === "POST" ? 201 : 200,
        contentType: "application/json",
        body: JSON.stringify({
          investigation: {
            id: "investigation-1",
            status: "active",
            resolutionKind: "unknown",
          },
        }),
      });
    });

    const response = await page.goto("/identify");
    test.skip(
      response?.status() === 404,
      "Pressing proof is disabled in this server process.",
    );

    await page.getByLabel("Artist or title").fill("Example Band Example Album");
    await page.getByRole("button", { name: "Find release family" }).click();
    await page
      .getByRole("button", {
        name: /The Example Band - Example Album/,
      })
      .click();

    await expect(page.getByText("Owned ×2")).toBeVisible();
    await page.getByRole("button", { name: "Save investigation" }).click();
    await expect(
      page.getByText(/saved with freshly revalidated evidence/i),
    ).toBeVisible();
    expect(savedRequests[0]).toMatchObject({
      method: "POST",
      body: {
        masterId: 456,
        seedReleaseId: 123,
        inputSource: "manual_search",
      },
    });

    await page.getByRole("button", { name: "Save investigation" }).click();
    await expect(
      page.getByText(/updated with freshly revalidated evidence/i),
    ).toBeVisible();
    expect(savedRequests[1]).toMatchObject({
      method: "PATCH",
      body: {
        id: "investigation-1",
        action: "resolve",
      },
    });
  });
});
