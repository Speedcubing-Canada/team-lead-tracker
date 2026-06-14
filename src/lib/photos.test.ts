import { beforeEach, describe, expect, it, vi } from "vitest";

// Firebase + image mocks (no live SDK / network in unit tests).
vi.mock("./firebase", () => ({
  db: () => ({ kind: "db" }),
  storage: () => ({ kind: "storage" }),
  auth: () => ({ currentUser: { uid: "wca:9" } }),
}));
vi.mock("./image", () => ({
  resizeImageToJpeg: vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" })),
}));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, path: string) => ({ path })),
  doc: vi.fn((_db, path: string) => ({ path })),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => "ts"),
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage, path: string) => ({ path })),
  uploadBytes: vi.fn(async () => {}),
  deleteObject: vi.fn(async () => {}),
  getDownloadURL: vi.fn(async () => "https://dl/url"),
}));

import { deleteDoc, onSnapshot, setDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import {
  removePersonPhoto,
  subscribePeoplePhotos,
  uploadPersonPhoto,
} from "./photos";

const user = { wcaUserId: 9, name: "Dana Delegate" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("subscribePeoplePhotos", () => {
  it("maps snapshot docs to a wcaUserId-keyed map", () => {
    let captured: ((snap: unknown) => void) | undefined;
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, cb: unknown) => {
      captured = cb as (snap: unknown) => void;
      return () => {};
    });

    const received: Map<number, unknown>[] = [];
    subscribePeoplePhotos("comp1", (m) => received.push(m));

    captured?.({
      forEach: (fn: (d: { id: string; data: () => unknown }) => void) => {
        fn({ id: "1002", data: () => ({ photoPath: "p", uploadedByName: "A", uploadedByWcaId: 7 }) });
      },
    });

    expect(received[0].get(1002)).toEqual({ photoPath: "p", uploadedByName: "A", uploadedByWcaId: 7 });
  });
});

describe("uploadPersonPhoto", () => {
  it("resizes, uploads to the wcaUserId path, and writes metadata", async () => {
    const file = new File(["x"], "face.png", { type: "image/png" });
    await uploadPersonPhoto("comp1", 1002, file, user);

    expect(ref).toHaveBeenCalledWith({ kind: "storage" }, "competitions/comp1/people/1002.jpg");
    expect(uploadBytes).toHaveBeenCalledWith(
      { path: "competitions/comp1/people/1002.jpg" },
      expect.any(Blob),
      { contentType: "image/jpeg" },
    );
    expect(setDoc).toHaveBeenCalledWith(
      { path: "competitions/comp1/people/1002" },
      expect.objectContaining({
        photoPath: "competitions/comp1/people/1002.jpg",
        uploadedByName: "Dana Delegate",
        uploadedByWcaId: 9,
      }),
      { merge: true },
    );
  });
});

describe("removePersonPhoto", () => {
  it("deletes both the object and the metadata doc", async () => {
    await removePersonPhoto("comp1", 1002);
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledWith({ path: "competitions/comp1/people/1002" });
  });

  it("ignores a missing object but still clears metadata", async () => {
    vi.mocked(deleteObject).mockRejectedValueOnce({ code: "storage/object-not-found" });
    await expect(removePersonPhoto("comp1", 1002)).resolves.toBeUndefined();
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("rethrows other storage errors", async () => {
    vi.mocked(deleteObject).mockRejectedValueOnce({ code: "storage/unauthorized" });
    await expect(removePersonPhoto("comp1", 1002)).rejects.toMatchObject({
      code: "storage/unauthorized",
    });
  });
});
