import { readFile } from "node:fs/promises";
import { COMP, FAKE_WCA, USERS } from "./fakeWca";
import { expect, firstGroup, openComp, pressed, row, test } from "./fixtures";

test.beforeEach(async ({ page, request }) => {
  // Day 1's groups end by 16:00 UTC; before they've run there's nothing to report.
  const wcif = await (await request.get(`${FAKE_WCA}/api/v0/competitions/${COMP}/wcif/public`)).json();
  await page.clock.setFixedTime(new Date(`${wcif.schedule.startDate}T17:00:00Z`));
  await openComp(page, USERS.bob);
  await firstGroup(page);
  await row(page, "Alice Anderson").getByRole("button", { name: "Present" }).click();
  await row(page, "Bob Brown").getByRole("button", { name: "Absent" }).click();
  await pressed(page, "Bob Brown", "Absent");
});

test("the dashboard names the absentee and the absence rate", async ({ page }) => {
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("1 person not doing their assignment")).toBeVisible();
  await expect(page.getByRole("main").getByText("Bob Brown").first()).toBeVisible();
  await expect(page.getByText("50%").first()).toBeVisible();

  await page.getByRole("button", { name: "All stages" }).click();
  await expect(page.getByText("1 person not doing their assignment")).toBeVisible();

  // Back to the stage keeps the group the lead was on.
  await page.getByRole("link", { name: "Stage" }).click();
  await pressed(page, "Bob Brown", "Absent");
});

test("the reimbursement export downloads a CSV with the staff", async ({ page }) => {
  await page.goto(`/c/${COMP}/reimbursement`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const csv = await readFile(await (await download).path(), "utf8");
  expect(csv).toContain("Bob Brown");
  expect(csv).toContain("Alice Anderson");
});
