import { beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { DELEGATE, LEAD, useEmulator } from "../emulator";

const COMP = "TestComp2026";
const PATH = `competitions/${COMP}/people/42.jpg`;
const JPEG = { contentType: "image/jpeg" };

const { env, contextFor } = useEmulator(COMP);

beforeEach(() =>
  env().withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), PATH), new Uint8Array([1, 2, 3]), JPEG);
  }),
);

const member = () => contextFor(LEAD.uid).storage();
const privileged = () => contextFor(DELEGATE.uid).storage();
const as = (claims?: Record<string, unknown>) =>
  claims ? env().authenticatedContext("u", claims).storage() : env().unauthenticatedContext().storage();

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
