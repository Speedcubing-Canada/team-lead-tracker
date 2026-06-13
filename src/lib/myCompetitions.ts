import type { MyCompetition } from "./wca";

/**
 * The user's competition list is fetched once during OAuth (the Cloud Function
 * holds the WCA token only then) and cached in localStorage so it survives
 * reloads of the signed-in session.
 */
const KEY = "wca_my_competitions";

export function storeMyCompetitions(competitions: MyCompetition[]): void {
  localStorage.setItem(KEY, JSON.stringify(competitions));
}

export function loadMyCompetitions(): MyCompetition[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as MyCompetition[];
  } catch {
    return [];
  }
}

export function clearMyCompetitions(): void {
  localStorage.removeItem(KEY);
}
