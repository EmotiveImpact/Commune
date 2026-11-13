import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { CommuneLocationFields, EMPTY_COMMUNE_LOCATION } from "../src/ui/CommuneLocationFields";

function Harness() {
  const [location, setLocation] = useState(EMPTY_COMMUNE_LOCATION);
  return <CommuneLocationFields type="Home" value={location} onChange={setLocation} idPrefix="t" />;
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("address suggestions", () => {
  it("stay off without a Google Places key: a plain address box that asks no one", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(/Home address/), { target: { value: "22 elm" } });
    await new Promise((done) => setTimeout(done, 350));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByText("Powered by Google")).toBeNull();
  });

  it("show Google's matches once the key is set and fill in the full address on a click", async () => {
    vi.stubEnv("VITE_GOOGLE_PLACES_KEY", "test-key");
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes(":autocomplete")
        ? { suggestions: [{ placePrediction: { placeId: "a", structuredFormat: { mainText: { text: "22 Elm Road" }, secondaryText: { text: "London E17, UK" } } } }] }
        : { formattedAddress: "22 Elm Rd, London E17 4QS, UK" },
    }));
    vi.stubGlobal("fetch", fetcher);
    render(<Harness />);
    const box = screen.getByLabelText(/Home address/) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "22 elm" } });
    fireEvent.click(await screen.findByRole("button", { name: /22 Elm Road/ }));
    await waitFor(() => expect(box.value).toBe("22 Elm Rd, London E17 4QS"));
    expect(screen.queryByText("Powered by Google")).toBeNull();
  });
});
