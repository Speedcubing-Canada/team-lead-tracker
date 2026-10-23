import { USERS } from "./fakeWca";
import { expect, firstGroup, openComp, pressed, row, saved, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await openComp(page, USERS.bob);
  await firstGroup(page);
});

test("present, absent and a note typed with the keyboard open survive a reload", async ({ page, request }) => {
  await row(page, "Alice Anderson").getByRole("button", { name: "Present" }).click();
  const bob = row(page, "Bob Brown");
  await bob.getByRole("button", { name: "Add note" }).click();
  await bob.getByRole("textbox").fill("left early");
  // Tap the mark while the note input still has focus (the Jun 28 regression).
  await bob.getByRole("button", { name: "Absent" }).click();
  await pressed(page, "Bob Brown", "Absent");
  await saved(request, { status: "present" }, { status: "absent", note: "left early" });

  await page.reload();
  await pressed(page, "Alice Anderson", "Present");
  await pressed(page, "Bob Brown", "Absent");
  await expect(row(page, "Bob Brown").getByRole("textbox")).toHaveValue("left early");
  await expect(page.getByText("Not saved")).toBeHidden();
});

test("a note on an unmarked staffer is saved on its own", async ({ page, request }) => {
  const bob = row(page, "Bob Brown");
  await bob.getByRole("button", { name: "Add note" }).click();
  await bob.getByRole("textbox").fill("swapped with Dave");
  await page.getByLabel("Stage").focus();
  await saved(request, { status: undefined, note: "swapped with Dave" });

  await page.reload();
  await expect(row(page, "Bob Brown").getByRole("textbox")).toHaveValue("swapped with Dave");
  await expect(row(page, "Bob Brown").getByRole("button", { name: "Present" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("tapping a mark again clears it, and a note added later keeps the mark", async ({ page, request }) => {
  const alice = row(page, "Alice Anderson");
  await alice.getByRole("button", { name: "Present" }).click();
  await alice.getByRole("button", { name: "Present" }).click();
  await alice.getByRole("button", { name: "Absent" }).click();
  await alice.getByRole("button", { name: "Add note" }).click();
  await alice.getByRole("textbox").fill("late 10 min");
  await page.getByLabel("Stage").focus();
  await saved(request, { status: "absent", note: "late 10 min" });

  await page.reload();
  await pressed(page, "Alice Anderson", "Absent");
  await expect(row(page, "Alice Anderson").getByRole("button", { name: "Present" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(row(page, "Alice Anderson").getByRole("textbox")).toHaveValue("late 10 min");
});
