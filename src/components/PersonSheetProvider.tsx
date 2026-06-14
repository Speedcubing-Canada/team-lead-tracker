import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { WcifPerson } from "../lib/wca";
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

/** Holds a single shared PersonSheet for its subtree (avoids prop-drilling). */
export function PersonSheetProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<WcifPerson | null>(null);
  const open = useCallback((p: WcifPerson) => setPerson(p), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <PersonSheetContext.Provider value={value}>
      {children}
      {person && <PersonSheet person={person} onClose={() => setPerson(null)} />}
    </PersonSheetContext.Provider>
  );
}
