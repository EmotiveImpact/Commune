import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { googlePlaces, type AddressSearch } from "./places";

type AppleModule = { suggest(query: string): Promise<Array<{ title: string; subtitle: string }>>; resolve(index: number): Promise<string | null> };

/**
 * Which address search the address box uses.
 * - iPhone: Apple's own search (Apple Maps), free with no key.
 * - Android and the web: Google Places, only once EXPO_PUBLIC_GOOGLE_PLACES_KEY
 *   is set in the build. Until then the box is plain text there.
 * Set EXPO_PUBLIC_ADDRESS_SEARCH=google to use Google on iPhone too.
 */
export function chooseAddressSearch(): AddressSearch | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY?.trim();
  const preferGoogle = process.env.EXPO_PUBLIC_ADDRESS_SEARCH?.trim() === "google";
  if (Platform.OS === "ios" && !(preferGoogle && key)) {
    const apple = requireOptionalNativeModule<AppleModule>("AddressSearch");
    if (apple) return appleSearch(apple);
  }
  if (key) return googlePlaces(key, (url, init) => fetch(url, init));
  return null;
}

function appleSearch(apple: AppleModule): AddressSearch {
  return {
    name: "apple",
    async suggest(query) {
      const rows = await apple.suggest(query).catch(() => []);
      return rows.map((row, index) => ({
        title: row.title, subtitle: row.subtitle,
        async pick() {
          const full = await apple.resolve(index).catch(() => null);
          return (full || [row.title, row.subtitle].filter(Boolean).join(", ")).slice(0, 160);
        },
      }));
    },
  };
}
