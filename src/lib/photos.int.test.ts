import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBytes, ref } from "firebase/storage";
import { DELEGATE, LEAD, firstValue, useEmulator } from "../test/emulator";
import { storage } from "./firebase";
import {
  fetchPrivileged,
  removePersonPhoto,
  subscribePeoplePhotos,
  uploadPersonPhoto,
  type PersonPhoto,
} from "./photos";

vi.mock("./firebase", () => import("../test/emulatorFirebase"));
// Canvas resizing is browser-only; the upload path is what's under test.
vi.mock("./image", () => ({
  resizeImageToJpeg: async () => new Blob([new Uint8Array(1024)], { type: "image/jpeg" }),
}));

const COMP = "PhotosComp2026";
const PATH = `competitions/${COMP}/people/42.jpg`;
const file = new File([], "me.jpg");

const { signInAs, as, seed } = useEmulator(COMP);
beforeEach(() => signInAs(DELEGATE.uid));

/** What a stage lead's live subscription receives. */
const seenByLead = () =>
  as(LEAD.uid, () => firstValue<Map<number, PersonPhoto>>((next, fail) => subscribePeoplePhotos(COMP, next, fail)));
const leadDownload = () => as(LEAD.uid, () => getBytes(ref(storage(), PATH)));

describe("person photos against the emulators", () => {
  it("uploads the photo and syncs its metadata to leads", async () => {
    await uploadPersonPhoto(COMP, 42, file, DELEGATE);

    expect((await seenByLead()).get(42)).toMatchObject({
      photoPath: PATH,
      uploadedByName: "Del",
      uploadedByWcaId: 2,
    });
    expect((await leadDownload()).byteLength).toBe(1024);
  });

  it("removes both the object and the metadata", async () => {
    await uploadPersonPhoto(COMP, 42, file, DELEGATE);
    await removePersonPhoto(COMP, 42);

    expect((await seenByLead()).size).toBe(0);
    await expect(leadDownload()).rejects.toMatchObject({ code: "storage/object-not-found" });
  });

  it("still clears the metadata when the object is already gone", async () => {
    await seed(`competitions/${COMP}/people/42`, { photoPath: PATH, uploadedByWcaId: 2 });
    await removePersonPhoto(COMP, 42);
    expect((await seenByLead()).size).toBe(0);
  });

  it("rejects an upload from a non-privileged lead", async () => {
    signInAs(LEAD.uid);
    await expect(uploadPersonPhoto(COMP, 42, file, LEAD)).rejects.toMatchObject({
      code: "storage/unauthorized",
    });
    expect((await seenByLead()).size).toBe(0);
  });

  it("reads privilege from the membership doc", async () => {
    await expect(fetchPrivileged(COMP)).resolves.toBe(true);
    signInAs(LEAD.uid);
    await expect(fetchPrivileged(COMP)).resolves.toBe(false);
  });
});
