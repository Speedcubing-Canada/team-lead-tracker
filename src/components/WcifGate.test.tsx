import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { WcifGate } from "./WcifGate";
import { sampleWcif } from "../test/fixtures/wcif";

vi.mock("../lib/useWcif", () => ({
  useWcif: () => ({ data: sampleWcif, isLoading: false, error: null }),
}));
vi.mock("../lib/useChecks", () => ({ useChecks: () => ({ checks: new Map(), error: null }) }));

function Where() {
  const { pathname, search } = useLocation();
  return <p>at {pathname + search}</p>;
}

/** Mirrors App.tsx: the gate lives in child routes of /c/:competitionId. */
function renderAt(url: string) {
  const gate = <WcifGate skeleton={null}>{(_w, id) => <p>loaded {id}</p>}</WcifGate>;
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/c/:competitionId" element={<Outlet />}>
          <Route index element={gate} />
          <Route path="shame" element={gate} />
        </Route>
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const ID = sampleWcif.id;

describe("WcifGate", () => {
  it.each([
    [`/c/${ID.toLowerCase()}`, `/c/${ID}`],
    [`/c/${ID.toLowerCase()}/shame?x=1`, `/c/${ID}/shame?x=1`],
  ])("redirects %s to WCA's canonical casing %s", (from, to) => {
    renderAt(from);
    expect(screen.getByText(`at ${to}`)).toBeInTheDocument();
    expect(screen.getByText(`loaded ${ID}`)).toBeInTheDocument();
  });

  it("renders a canonical URL in place", () => {
    renderAt(`/c/${ID}/shame`);
    expect(screen.getByText(`at /c/${ID}/shame`)).toBeInTheDocument();
    expect(screen.getByText(`loaded ${ID}`)).toBeInTheDocument();
  });
});
