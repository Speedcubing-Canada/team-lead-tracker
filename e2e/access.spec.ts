import { COMP, COMP_NAME, USERS, WCA_DOWN } from "./fakeWca";
import { expect, loginAs, startLogin, test } from "./fixtures";

test("a plain competitor is turned away", async ({ page }) => {
  await loginAs(page, USERS.pat);
  await page.getByRole("button", { name: new RegExp(COMP_NAME) }).click();
  await expect(page.getByText("No access")).toBeVisible({ timeout: 15_000 });
  const reason = "Your WCA account isn't a delegate, organizer, or staff member of this competition.";
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("an unknown competition ID shows the not-found box", async ({ page }) => {
  await loginAs(page, USERS.alice);
  await page.getByRole("button", { name: "Enter a competition ID manually" }).click();
  await page.getByLabel("Competition ID").fill("Nope2026");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Competition not found")).toBeVisible({ timeout: 15_000 });
});

test("a logged-out visit to a competition goes to the login screen", async ({ page }) => {
  await page.goto(`/c/${COMP}`);
  await expect(page.getByRole("button", { name: "Log in with WCA" })).toBeVisible();
});

test("a WCA outage during login explains itself instead of showing a raw error code", async ({ page }) => {
  await startLogin(page, WCA_DOWN);
  await expect(page.getByText("Login failed. Is the server reachable?")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back to login" }).click();
  await expect(page.getByRole("button", { name: "Log in with WCA" })).toBeVisible();
});
