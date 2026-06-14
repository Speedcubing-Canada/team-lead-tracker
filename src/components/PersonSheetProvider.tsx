import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WcifPerson } from "../lib/wca";
import { photoDownloadUrl, type PersonPhoto } from "../lib/photos";
import { PersonSheet } from "./PersonSheet";

interface PersonSheetContextValue {
  open: (person: WcifPerson) => void;
}

// Defaults to a no-op so name triggers (and their unit tests) render fine
// without a provider; the real `open` is supplied by PersonSheetProvider.
const PersonSheetContext = createContext<PersonSheetContextValue>({ open: () => {} });

export function usePersonSheet(): PersonSheetContextValue {
  return useContext(PersonSheetContext);
}

/**
 * Holds a single shared PersonSheet for its subtree (avoids prop-drilling).
 * The photo wiring is injected (optionally) by AppShell, which knows the
 * competition and signed-in user; the provider itself stays free of router /
 * auth / Firebase deps so it renders in isolation (and in unit tests).
 */
export function PersonSheetProvider({
  children,
  photos,
  canUpload = false,
  onUploadPhoto,
  onRemovePhoto,
}: {
  children: ReactNode;
  photos?: Map<number, PersonPhoto>;
  canUpload?: boolean;
  onUploadPhoto?: (wcaUserId: number, file: File) => Promise<void>;
  onRemovePhoto?: (wcaUserId: number) => Promise<void>;
}) {
  const [person, setPerson] = useState<WcifPerson | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const open = useCallback((p: WcifPerson) => setPerson(p), []);
  const value = useMemo(() => ({ open }), [open]);

  const photo = person ? (photos?.get(person.wcaUserId) ?? null) : null;

  // Resolve the uploaded photo's download URL only while a card is open — keeps
  // the picture bytes strictly on demand.
  useEffect(() => {
    let active = true;
    setPhotoUrl(null);
    if (photo) {
      photoDownloadUrl(photo.photoPath)
        .then((url) => {
          if (active) setPhotoUrl(url);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [photo]);

  return (
    <PersonSheetContext.Provider value={value}>
      {children}
      {person && (
        <PersonSheet
          person={person}
          onClose={() => setPerson(null)}
          photo={photo}
          photoUrl={photoUrl}
          canUpload={canUpload && !!onUploadPhoto}
          onUpload={onUploadPhoto ? (file) => onUploadPhoto(person.wcaUserId, file) : undefined}
          onRemove={onRemovePhoto ? () => onRemovePhoto(person.wcaUserId) : undefined}
        />
      )}
    </PersonSheetContext.Provider>
  );
}
