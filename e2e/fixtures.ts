import { test as base, devices, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { COMP, COMP_NAME, FAKE_WCA, USER_COOKIE } from "./fakeWca";

const PROJECT = "demo-e2e";
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

export const test = base.extend<{ resetEmulators: void; secondLead: (wcaUserId: number) => Promise<Page> }>({
  /** Every test starts from empty emulators; specs share them, so they run one at a time. */
  resetEmulators: [
    async ({ request }, use) => {
      for (const url of [
        `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
        `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`,
      ]) {
        expect((await request.delete(url)).ok()).toBe(true);
      }
      await use();
    },
    { auto: true },
  ],
  /** Another lead on their own phone, opened on the fake comp. */
  secondLead: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (wcaUserId) => {
      const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: baseURL! });
      contexts.push(context);
      const page = await context.newPage();
      await openComp(page, wcaUserId);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };

/** Log in through the (fake) WCA OAuth flow and land on the competition list. */
export async function loginAs(page: Page, wcaUserId: number) {
  await startLogin(page, wcaUserId);
  // The first call cold-starts the functions emulator.
  await expect(page.getByRole("heading", { name: "Your competitions" })).toBeVisible({ timeout: 30_000 });
}

/** Click through the WCA login without waiting for its outcome. */
export async function startLogin(page: Page, wcaUserId: number) {
  await page.context().addCookies([{ name: USER_COOKIE, value: String(wcaUserId), url: FAKE_WCA }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Log in with WCA" }).click();
}

/** Log in and open the fake comp from the list. */
export async function openComp(page: Page, wcaUserId: number) {
  await loginAs(page, wcaUserId);
  await page.getByRole("button", { name: new RegExp(COMP_NAME) }).click();
  await expect(page.getByLabel("Stage")).toBeVisible();
}

type StoredCheck = { status?: string | undefined; note?: string | undefined };

async function storedChecks(request: APIRequestContext): Promise<StoredCheck[]> {
  const res = await request.get(`${FIRESTORE}/competitions/${COMP}/checks`, {
    headers: { Authorization: "Bearer owner" },
  });
  const { documents = [] } = (await res.json()) as {
    documents?: { fields: Record<string, { stringValue?: string }> }[];
  };
  return documents.map((d) => ({ status: d.fields["status"]?.stringValue, note: d.fields["note"]?.stringValue }));
}

/** Wait until the emulator holds these checks: the page shows a write before Firestore commits it. */
export const saved = (request: APIRequestContext, ...checks: StoredCheck[]) =>
  expect
    .poll(() => storedChecks(request))
    .toEqual(expect.arrayContaining(checks.map((c) => expect.objectContaining(c))));

/** The staff row for a person in the current group. */
export const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

/** Show the first group of the stage: Alice judges it, Bob scrambles it. */
export const firstGroup = (page: Page) => page.getByLabel("Group", { exact: true }).selectOption({ index: 0 });

export const pressed = (page: Page, name: string, mark: "Present" | "Absent") =>
  expect(row(page, name).getByRole("button", { name: mark })).toHaveAttribute("aria-pressed", "true");
