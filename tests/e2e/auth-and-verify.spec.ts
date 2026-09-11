import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke covering the public surface and the login gate. Run against
 * a seeded instance: `pnpm db:seed` then `pnpm test:e2e`.
 */

test("public verify landing renders", async ({ page }) => {
  await page.goto("/verify");
  await expect(page.getByRole("heading", { name: /Verifikasi Keaslian Dokumen/i })).toBeVisible();
});

test("unknown verification token shows NOT FOUND", async ({ page }) => {
  await page.goto("/verify/this-token-does-not-exist");
  await expect(page.getByText(/Tidak Ditemukan/i)).toBeVisible();
});

test("protected route redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("lecturer can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("dosen@yppi-rembang.ac.id");
  await page.getByLabel("Kata sandi").fill("Password123!");
  await page.getByRole("button", { name: /Masuk/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Total RPS/i)).toBeVisible();
});
