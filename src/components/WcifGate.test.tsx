import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { WcifGate } from "./WcifGate";
import { sampleWcif } from "../test/fixtures/wcif";

vi.mock("../lib/useWcif", () => ({
  useWcif: () => ({ data: sampleWcif, isLoading: false, error: null }),
}));
vi.mock("../lib/useChecks", () => ({ useChecks: () => ({ checks: new Map(), error: null }) }));

function Where() {
  const { pathname, search } = useLocation();
  return <p>{pathname + search}</p>;
}

describe("WcifGate", () => {
  it("redirects a differently-cased id to WCA's canonical one, keeping the subpath", () => {
    render(
      <MemoryRouter initialEntries={[`/c/${sampleWcif.id.toLowerCase()}/dashboard?x=1`]}>
        <Routes>
          <Route
            path="/c/:competitionId/*"
            element={
              <WcifGate skeleton={null}>{(_w, id) => <p>loaded {id}</p>}</WcifGate>
            }
          />
        </Routes>
        <Where />
      </MemoryRouter>,
    );
    expect(screen.getByText(`/c/${sampleWcif.id}/dashboard?x=1`)).toBeInTheDocument();
    expect(screen.getByText(`loaded ${sampleWcif.id}`)).toBeInTheDocument();
  });
});
