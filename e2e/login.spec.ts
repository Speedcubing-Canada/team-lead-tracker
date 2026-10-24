import { COMP, COMP_NAME, USERS } from "./fakeWca";
import { atVenue, expect, loginAs, openComp, test } from "./fixtures";

test("a staff lead logs in, opens their comp and lands on the stage they staff", async ({ page }) => {
  await loginAs(page, USERS.dave);
  await expect(page.getByText("Signed in as Dave Davis")).toBeVisible();

  const comp = page.getByRole("button", { name: new RegExp(COMP_NAME) });
  await expect(comp).toContainText("Live");
  await comp.click();

  await expect(page).toHaveURL(`/c/${COMP}`);
  // Dave competes on Red but judges on Blue: the stage is the one he staffs.
  await expect(page.getByLabel("Stage")).toHaveValue(/./);
  await expect(page.getByLabel("Stage").locator("option:checked")).toHaveText("Blue Stage");
});

test("the session survives a reload", async ({ page }) => {
  await loginAs(page, USERS.bob);
  await page.reload();
  await expect(page.getByText("Signed in as Bob Brown")).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(COMP_NAME) })).toBeVisible();
});

test.describe("on a phone set to a timezone far from the venue", () => {
  test.use({ timezoneId: "Pacific/Auckland" });

  test("the board opens on the group running now at the venue", async ({ page, request }) => {
    // Red's 3x3 group 2 runs 13:30-14:00 UTC on day 1.
    await atVenue(page, request, "13:45");
    await openComp(page, USERS.bob);
    await expect(page.getByLabel("Group", { exact: true }).locator("option:checked")).toHaveText(/2/);
    await expect(page.getByText("Group 2 of 3")).toBeVisible();
  });
});

test("after signing out, the next lead on the same phone lands on their own stage", async ({ page }) => {
  await openComp(page, USERS.dave);
  await expect(page.getByLabel("Stage").locator("option:checked")).toHaveText("Blue Stage");
  await page.getByRole("link", { name: "Comps" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Log in with WCA" })).toBeVisible();

  await openComp(page, USERS.bob);
  await expect(page.getByLabel("Stage").locator("option:checked")).toHaveText("Red Stage");
});
