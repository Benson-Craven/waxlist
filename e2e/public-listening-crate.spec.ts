import { expect, test } from "@playwright/test";

test.describe("invite-only Spotify-first beta", () => {
  test("shows Spotify first with ListenBrainz and YouTube alternatives", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "WAXLIST" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start with Spotify" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Use ListenBrainz" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Add YouTube links" }),
    ).toBeVisible();
    await expect(page.getByText(/Invite-only beta/)).toBeVisible();

    await page.getByRole("link", { name: "Start with Spotify" }).click();
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("creates a neutral account and opens the listening crate", async ({
    page,
  }) => {
    const email = "waxlist-e2e-invited@example.com";
    let accountCreated = false;

    try {
      await page.goto("/");
      await page.getByRole("link", { name: "Start with Spotify" }).click();
      await expect(page).toHaveURL(
        "http://127.0.0.1:3000/auth/sign-up?source=spotify",
      );
      await page.getByLabel("Name").fill("WAXLIST E2E Check");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("Disposable-auth-check-24");
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page).toHaveURL(
        /\/app\?view=crate&source=spotify$/,
      );
      accountCreated = true;
      await expect(
        page.getByRole("navigation", { name: "Crate source" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Spotify" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        page.getByRole("link", { name: "Connect Spotify" }),
      ).toHaveAttribute("href", "/api/auth/spotify/login");
      const localSpotifyStart = await page.context().request.get(
        "http://localhost:3000/api/auth/spotify/login",
        { maxRedirects: 0 },
      );
      const canonicalSpotifyStartUrl =
        localSpotifyStart.headers().location ?? "";

      expect(localSpotifyStart.status()).toBe(307);
      expect(canonicalSpotifyStartUrl).toBe(
        "http://127.0.0.1:3000/api/auth/spotify/login",
      );

      const canonicalSpotifyStart = await page.context().request.get(
        canonicalSpotifyStartUrl,
        { maxRedirects: 0 },
      );

      expect(canonicalSpotifyStart.status()).toBe(307);
      expect(canonicalSpotifyStart.headers().location).toMatch(
        /^https:\/\/accounts\.spotify\.com\/authorize\?/,
      );

      await page.getByRole("link", { name: "YouTube" }).click();
      await expect(page).toHaveURL(/\/app\?view=crate&source=youtube$/);
      await expect(
        page.getByText("Watch-history import · Coming soon"),
      ).toBeVisible();
      await page
        .getByLabel(/One youtube\.com/)
        .fill("https://youtu.be/dQw4w9WgXcQ?t=42");
      await page.getByRole("button", { name: "Review links" }).click();
      await expect(
        page.getByRole("heading", { name: "Confirm album evidence" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Open YouTube" }),
      ).toHaveAttribute(
        "href",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
      await page
        .getByRole("textbox", { name: "Artist", exact: true })
        .fill("<img src=x onerror=alert(1)>");
      await page
        .getByRole("textbox", { name: "Album", exact: true })
        .fill("<script>alert(1)</script>");
      await expect(page.locator("img[src='x']")).toHaveCount(0);
      await expect(page.locator("script").filter({ hasText: "alert(1)" })).toHaveCount(
        0,
      );

      await page.getByRole("link", { name: "ListenBrainz" }).click();
      await expect(page).toHaveURL(
        /\/app\?view=crate&source=listenbrainz$/,
      );
      await expect(page.getByLabel("ListenBrainz username")).toBeVisible();
    } finally {
      if (accountCreated) {
        const deletion = await page
          .context()
          .request.post("/api/privacy/delete-data", {
            headers: {
              accept: "application/json",
            },
          });

        expect(deletion.status()).toBe(200);
        await expect(deletion.json()).resolves.toMatchObject({
          ok: true,
          deletedUser: true,
          deletedAuthUser: true,
        });
      }
    }
  });

  test("keeps restricted provider routes closed", async ({ request }) => {
    const responses = await Promise.all([
      request.get("/api/discogs/import/collection"),
      request.post("/api/wishlist/seller-scout", { data: {} }),
      request.post("/api/discogs/identify-copy", { data: {} }),
      request.get("/api/wishlist"),
      request.get("/api/wishlist/smart-wants"),
      request.post("/api/collection", { data: { source: "wishlist" } }),
      request.get("/api/listening/youtube/watch-history"),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "capability_disabled",
        },
      });
    }
  });
});
