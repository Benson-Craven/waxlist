import { expect, test } from "@playwright/test";
import { SPOTIFY_SESSION_COOKIE } from "../lib/constants";
import { encodeSpotifySession } from "../lib/spotify/oauth";

const SESSION_SECRET = process.env.SESSION_SECRET;

test.describe("OAuth-connected smoke flow", () => {
  test.skip(
    !SESSION_SECRET || SESSION_SECRET.length < 32,
    "SESSION_SECRET with at least 32 characters is required to mint a local smoke-test session cookie.",
  );

  test("renders the connected workspace shell and consumes mocked Spotify route data", async ({
    page,
    baseURL,
    context,
  }) => {
    const url = new URL(baseURL ?? "http://localhost:3000");
    const sessionCookie = encodeSpotifySession(
      {
        accessToken: "playwright-access-token",
        refreshToken: "playwright-refresh-token",
        expiresIn: 3600,
        scope: "playlist-read-private user-library-read",
        tokenType: "Bearer",
      },
      SESSION_SECRET!,
    );

    await context.addCookies([
      {
        name: SPOTIFY_SESSION_COOKIE,
        value: sessionCookie,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
        expires: Math.floor(Date.now() / 1000) + 3600,
      },
    ]);

    await page.route("**/api/spotify/profile", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            id: "user-1",
            displayName: "Smoke Tester",
            email: null,
            country: "US",
            product: "premium",
            uri: "spotify:user:user-1",
            externalUrl: "https://open.spotify.com/user/user-1",
            imageUrl: null,
          },
        }),
      });
    });
    await page.route("**/api/spotify/playlists**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          playlists: [
            {
              id: "playlist-1",
              name: "Smoke Playlist",
              description: null,
              imageUrl: null,
              trackCount: 12,
              ownerName: "Smoke Tester",
              isPublic: false,
              isCollaborative: false,
              uri: "spotify:playlist:playlist-1",
              externalUrl: "https://open.spotify.com/playlist/playlist-1",
              snapshotId: "snapshot-1",
            },
          ],
          paging: {
            limit: 12,
            offset: 0,
            total: 1,
            next: null,
            previous: null,
          },
        }),
      });
    });
    await page.route("**/api/spotify/albums**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          albums: [],
          paging: {
            limit: 12,
            offset: 0,
            total: 0,
            next: null,
            previous: null,
          },
        }),
      });
    });

    await page.goto("/app");

    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/ })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Find collection gaps before buying candidates",
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Build crate/ }).click();
    await expect(page.getByRole("heading", { name: "Crate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Playlists" })).toBeVisible();
    await page.getByRole("button", { name: "Playlists" }).click();
    await expect(
      page.getByRole("button", { name: /Private Smoke Playlist 12/ }),
    ).toBeVisible();
  });
});
