// The same Google Places lookup as apps/native/src/lib/places.ts. Keep the two in step.
/**
 * Address suggestions as the address box shows them, from whichever service
 * is switched on. `pick` returns the full address to put in the box.
 */
export type AddressSuggestion = { title: string; subtitle: string; pick(): Promise<string> };
export type AddressSearch = { name: "apple" | "google"; suggest(query: string): Promise<AddressSuggestion[]> };

type Fetch = (url: string, init: { method?: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type Prediction = { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } };

const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS = "https://places.googleapis.com/v1/places/";

/** Shown without the country when it is the only one people here use. */
export function tidyAddress(text: string): string {
  return text.replace(/,\s*(UK|United Kingdom)$/i, "").trim().slice(0, 160);
}

/**
 * Google Places (the new Places API). Off until a key is set. One session
 * token covers the typing and the pick, so Google bills it as one lookup.
 */
export function googlePlaces(key: string, fetcher: Fetch, token: () => string = randomToken): AddressSearch {
  let session = token();
  return {
    name: "google",
    async suggest(query) {
      const text = query.trim();
      if (text.length < 3) return [];
      const response = await fetcher(AUTOCOMPLETE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({ input: text, sessionToken: session, includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"] }),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { suggestions?: Array<{ placePrediction?: Prediction }> };
      return (data.suggestions ?? []).flatMap(({ placePrediction: place }) => {
        if (!place?.placeId) return [];
        const title = place.structuredFormat?.mainText?.text ?? place.text?.text ?? "";
        const subtitle = tidyAddress(place.structuredFormat?.secondaryText?.text ?? "");
        const fallback = tidyAddress([title, subtitle].filter(Boolean).join(", "));
        return [{
          title, subtitle,
          async pick() {
            const used = session;
            session = token();
            try {
              const details = await fetcher(`${DETAILS}${encodeURIComponent(place.placeId!)}?sessionToken=${encodeURIComponent(used)}`, {
                headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "formattedAddress" },
              });
              if (!details.ok) return fallback;
              const found = (await details.json()) as { formattedAddress?: string };
              return found.formattedAddress ? tidyAddress(found.formattedAddress) : fallback;
            } catch { return fallback; }
          },
        }];
      }).slice(0, 5);
    },
  };
}

function randomToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
