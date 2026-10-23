import { USERS } from "./fakeWca";
import { expect, firstGroup, newLead, openComp, pressed, row, test } from "./fixtures";

test("two leads on the same stage see each other's marks and notes live", async ({ page, browser }) => {
  await openComp(page, USERS.bob);
  const alice = await newLead(browser, USERS.alice);
  await firstGroup(page);
  await firstGroup(alice);

  await row(alice, "Bob Brown").getByRole("button", { name: "Absent" }).click();
  await pressed(page, "Bob Brown", "Absent");

  await row(page, "Alice Anderson").getByRole("button", { name: "Present" }).click();
  await pressed(alice, "Alice Anderson", "Present");

  const bobOnAlice = row(alice, "Bob Brown");
  await bobOnAlice.getByRole("button", { name: "Add note" }).click();
  await bobOnAlice.getByRole("textbox").fill("not answering phone");
  await alice.getByLabel("Stage").focus();
  await expect(row(page, "Bob Brown").getByRole("textbox")).toHaveValue("not answering phone");

  await alice.context().close();
});

test("a mark made while the wifi is down reaches the other lead once it's back", async ({ page, browser }) => {
  await openComp(page, USERS.bob);
  const alice = await newLead(browser, USERS.alice);
  await firstGroup(page);
  await firstGroup(alice);

  await page.context().setOffline(true);
  await row(page, "Alice Anderson").getByRole("button", { name: "Absent" }).click();
  await pressed(page, "Alice Anderson", "Absent");
  await page.context().setOffline(false);

  await pressed(alice, "Alice Anderson", "Absent");
  await expect(page.getByText("Not saved")).toBeHidden();
  await alice.context().close();
});
