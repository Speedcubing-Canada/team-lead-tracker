import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageError,
} from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { resizeImageToJpeg } from "./image";
import type { AuthUser } from "../auth/AuthContext";

/**
 * Delegate-uploaded photos. Bytes live in Storage at
 * `competitions/{compId}/people/{wcaUserId}.jpg`; lightweight metadata is mirrored
 * in Firestore so all leads see new photos live (like checks). The card prefers
 * an uploaded photo over the WCA avatar when present.
 */
export interface PersonPhoto {
  photoPath: string;
  uploadedByName: string;
  uploadedByWcaId: number;
}

function storagePath(competitionId: string, wcaUserId: number): string {
  return `competitions/${competitionId}/people/${wcaUserId}.jpg`;
}

function metaRef(competitionId: string, wcaUserId: number) {
  return doc(db(), `competitions/${competitionId}/people/${wcaUserId}`);
}

/** Live subscription to a competition's uploaded photos, keyed by wcaUserId. */
export function subscribePeoplePhotos(
  competitionId: string,
  onChange: (photos: Map<number, PersonPhoto>) => void,
): () => void {
  const colRef = collection(db(), `competitions/${competitionId}/people`);
  return onSnapshot(colRef, (snap) => {
    const map = new Map<number, PersonPhoto>();
    snap.forEach((d) => map.set(Number(d.id), d.data() as PersonPhoto));
    onChange(map);
  });
}

/** Resize the picked image, upload it, then record metadata for live sync. */
export async function uploadPersonPhoto(
  competitionId: string,
  wcaUserId: number,
  file: File,
  user: AuthUser,
): Promise<void> {
  const blob = await resizeImageToJpeg(file);
  const path = storagePath(competitionId, wcaUserId);
  await uploadBytes(ref(storage(), path), blob, { contentType: "image/jpeg" });
  await setDoc(
    metaRef(competitionId, wcaUserId),
    {
      photoPath: path,
      uploadedByName: user.name,
      uploadedByWcaId: user.wcaUserId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Remove both the Storage object and its metadata (reverts to the WCA avatar). */
export async function removePersonPhoto(
  competitionId: string,
  wcaUserId: number,
): Promise<void> {
  try {
    await deleteObject(ref(storage(), storagePath(competitionId, wcaUserId)));
  } catch (err) {
    // A missing object is fine — we still want to clear the metadata.
    if ((err as StorageError).code !== "storage/object-not-found") throw err;
  }
  await deleteDoc(metaRef(competitionId, wcaUserId));
}

/** Resolve a stored photo path to a download URL (fetched on demand by the card). */
export function photoDownloadUrl(photoPath: string): Promise<string> {
  return getDownloadURL(ref(storage(), photoPath));
}

/**
 * Whether the signed-in user is a privileged member (delegate/organizer) of this
 * competition, read from their own membership doc. UI gating only — the real
 * enforcement is in firestore.rules / storage.rules.
 */
export async function fetchPrivileged(competitionId: string): Promise<boolean> {
  const uid = auth().currentUser?.uid;
  if (!uid) return false;
  const snap = await getDoc(doc(db(), `competitions/${competitionId}/members/${uid}`));
  return snap.exists() && snap.data().privileged === true;
}
