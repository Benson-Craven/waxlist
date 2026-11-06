import { expect, test } from "@playwright/test";

test.describe("authentication and login flow", () => {
  test("sign-in form validates and explains errors", async ({ page }) => {
    await page.goto(
      "http://127.0.0.1:3000/auth/sign-in?next=%2Fapp%3Fview%3Dcollection",
    );

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue(
      "/app?view=collection",
    );

    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#auth-form-error")).toContainText(
      "Enter your email and password to continue.",
    );

    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.locator('input[name="password"]')).toHaveAttribute(
      "type",
      "text",
    );
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("#auth-form-error")).toBeVisible();
    await expect(page.locator("#auth-form-error")).not.toContainText(
      "Invalid email or password",
    );
  });

  test("protected workspace returns to the requested view after sign-in", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:3000/app?view=collection&q=sade");

    await expect(page).toHaveURL(/\/auth\/sign-in\?/);
    const url = new URL(page.url());

    expect(url.searchParams.get("next")).toBe("/app?view=collection&q=sade");
    expect(url.searchParams.get("status")).toBe("auth_required");
    await expect(page.getByRole("status")).toContainText(
      "Sign in to open your workspace.",
    );
  });

  test("sign-up form keeps the invite and destination context", async ({
    page,
  }) => {
    await page.goto(
      "http://127.0.0.1:3000/auth/sign-up?source=listenbrainz&next=%2Fapp%3Fview%3Dcrate%26source%3Dlistenbrainz",
    );

    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(page.locator('input[name="source"]')).toHaveValue(
      "listenbrainz",
    );
    await expect(page.locator('input[name="next"]')).toHaveValue(
      "/app?view=crate&source=listenbrainz",
    );
    await expect(
      page.getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", /next=/);
  });

  test("localhost is canonicalised onto the app origin", async ({ page }) => {
    await page.goto("http://localhost:3000/auth/sign-in");

    expect(new URL(page.url()).host).toBe("127.0.0.1:3000");
  });
});
