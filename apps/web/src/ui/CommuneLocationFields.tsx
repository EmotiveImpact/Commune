import { useEffect, useMemo, useRef, useState } from "react";
import type { Hub } from "../data/household";
import { LIMITS } from "../data/limits";
import { googlePlaces, type AddressSearch, type AddressSuggestion } from "../live/places";

/** Google address suggestions, off until VITE_GOOGLE_PLACES_KEY is set in the build. */
function placesSearch(): AddressSearch | null {
  const key = import.meta.env.VITE_GOOGLE_PLACES_KEY?.trim();
  return key ? googlePlaces(key, (url, init) => fetch(url, init)) : null;
}

/** Matching addresses under an address box as you type; a click fills in the full address. */
function useSuggestions(search: AddressSearch | null, text: string, typed: boolean) {
  const [rows, setRows] = useState<AddressSuggestion[]>([]);
  const asked = useRef(0);
  useEffect(() => {
    if (!search || !typed || text.trim().length < 3) { setRows([]); return; }
    const ask = ++asked.current;
    const timer = setTimeout(() => {
      search.suggest(text).then((found) => { if (ask === asked.current) setRows(found); }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, text, typed]);
  return { rows, clear() { asked.current += 1; setRows([]); } };
}

function AddressInput({ id, value, maxLength, placeholder, disabled, search, onChange }: {
  id: string; value: string; maxLength: number; placeholder: string; disabled: boolean; search: AddressSearch | null; onChange(value: string): void;
}) {
  const [typed, setTyped] = useState(false);
  const { rows, clear } = useSuggestions(search, value, typed);
  async function choose(row: AddressSuggestion) {
    clear();
    setTyped(false);
    const full = await row.pick().catch(() => [row.title, row.subtitle].filter(Boolean).join(", "));
    onChange(full.slice(0, maxLength));
  }
  return <>
    <input id={id} type="text" value={value} maxLength={maxLength} placeholder={placeholder} disabled={disabled}
      autoComplete={search ? "off" : "street-address"} aria-autocomplete={search ? "list" : undefined}
      aria-controls={rows.length ? `${id}-suggestions` : undefined}
      onChange={(event) => { setTyped(true); onChange(event.target.value); }}
      onKeyDown={(event) => { if (event.key === "Escape") clear(); }} />
    {rows.length ? <div className="a-address-suggestions" id={`${id}-suggestions`}>
      {rows.map((row, index) => <button type="button" key={`${row.title}-${index}`} onClick={() => void choose(row)}>
        <strong>{row.title}</strong>{row.subtitle ? <span>{row.subtitle}</span> : null}
      </button>)}
      <small>Powered by Google</small>
    </div> : null}
  </>;
}

export type CommuneLocation = {
  address: string;
  destination: string;
  stayName: string;
  stayAddress: string;
};

export const EMPTY_COMMUNE_LOCATION: CommuneLocation = {
  address: "",
  destination: "",
  stayName: "",
  stayAddress: "",
};

type Field = keyof CommuneLocation;

export function CommuneLocationFields({
  type,
  value,
  onChange,
  disabled = false,
  idPrefix,
}: {
  type: Hub["type"];
  value: CommuneLocation;
  onChange: (next: CommuneLocation) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const search = useMemo(placesSearch, []);
  function field(key: Field, label: string, placeholder: string, maxLength: number) {
    const id = `${idPrefix}-${key}`;
    const address = key === "address" || key === "stayAddress";
    return (
      <div className="a-field" key={key}>
        <label htmlFor={id}>{label} <span className="a-field-optional">(optional)</span></label>
        {address ? <AddressInput id={id} value={value[key]} maxLength={maxLength} placeholder={placeholder} disabled={disabled}
          search={search} onChange={(next) => onChange({ ...value, [key]: next })} /> : <input
          id={id}
          type="text"
          value={value[key]}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        />}
        <span className="a-field-limit">{value[key].length}/{maxLength}</span>
      </div>
    );
  }

  if (type === "Trip") {
    return <>
      {field("destination", "Destination area", "e.g. Lisbon, Portugal", LIMITS.destination)}
      {field("stayName", "Stay or hotel name", "e.g. Casa Azul", LIMITS.stayName)}
      {field("stayAddress", "Stay address", "Street address and postcode", LIMITS.address)}
    </>;
  }

  return field("address", type === "Workspace" ? "Workspace address" : "Home address", "Street address, town and postcode", LIMITS.address);
}
