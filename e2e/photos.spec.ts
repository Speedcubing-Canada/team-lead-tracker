import { USERS } from "./fakeWca";
import { expect, firstGroup, newLead, openComp, row, test } from "./fixtures";

// 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a delegate uploads a staffer's photo; a staff lead sees it but can't upload", async ({
  page,
  browser,
}) => {
  await openComp(page, USERS.alice);
  await firstGroup(page);
  await row(page, "Bob Brown").getByRole("button", { name: "Bob Brown" }).click();
  const sheet = page.getByRole("dialog", { name: "Bob Brown" });
  await sheet.locator('input[type="file"]').setInputFiles({ name: "bob.png", mimeType: "image/png", buffer: PNG });
  await expect(sheet.getByText("Photo added by Alice Anderson")).toBeVisible();
  await expect(sheet.getByRole("img", { name: "Bob Brown" })).toHaveAttribute("src", /127\.0\.0\.1:9199/);

  const bob = await newLead(browser, USERS.bob);
  await firstGroup(bob);
  await row(bob, "Bob Brown").getByRole("button", { name: "Bob Brown" }).click();
  const bobSheet = bob.getByRole("dialog", { name: "Bob Brown" });
  await expect(bobSheet.getByRole("img", { name: "Bob Brown" })).toHaveAttribute("src", /127\.0\.0\.1:9199/);
  await expect(bobSheet.getByText("Upload photo")).toBeHidden();
  await bob.context().close();
});
