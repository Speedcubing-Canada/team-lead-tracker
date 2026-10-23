import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const COMP = "TestComp2026";
const PATH = `competitions/${COMP}/people/42.jpg`;
const JPEG = { contentType: "image/jpeg" };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-test",
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), PATH), new Uint8Array([1, 2, 3]), JPEG);
  });
});

const as = (claims?: Record<string, unknown>) =>
  claims ? env.authenticatedContext("u", claims).storage() : env.unauthenticatedContext().storage();

const member = () => as({ comps: { [COMP]: true } });
const privileged = () => as({ comps: { [COMP]: true }, privilegedComps: { [COMP]: true } });

describe("person photos", () => {
  it("lets a member read", async () => {
    await assertSucceeds(getBytes(ref(member(), PATH)));
  });

  it("lets a privileged member upload an image under 2 MB and delete it", async () => {
    await assertSucceeds(uploadBytes(ref(privileged(), PATH), new Uint8Array(1024), JPEG));
    await assertSucceeds(deleteObject(ref(privileged(), PATH)));
  });

  it("rejects non-image uploads and files of 2 MB or more", async () => {
    await assertFails(
      uploadBytes(ref(privileged(), PATH), new Uint8Array(8), { contentType: "text/plain" }),
    );
    await assertFails(uploadBytes(ref(privileged(), PATH), new Uint8Array(2 * 1024 * 1024), JPEG));
  });

  it("denies writes from non-privileged members", async () => {
    await assertFails(uploadBytes(ref(member(), PATH), new Uint8Array(8), JPEG));
    await assertFails(deleteObject(ref(member(), PATH)));
  });

  it("denies tokens without claims, other comps' claims, and signed-out users", async () => {
    for (const storage of [
      as({}),
      as({ comps: { OtherComp: true }, privilegedComps: { OtherComp: true } }),
      as(),
    ]) {
      await assertFails(getBytes(ref(storage, PATH)));
      await assertFails(uploadBytes(ref(storage, PATH), new Uint8Array(8), JPEG));
    }
  });
});
