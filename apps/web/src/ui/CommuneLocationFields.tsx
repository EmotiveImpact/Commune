import type { Hub } from "../data/household";
import { LIMITS } from "../data/limits";

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
  function field(key: Field, label: string, placeholder: string, maxLength: number) {
    const id = `${idPrefix}-${key}`;
    return (
      <div className="a-field" key={key}>
        <label htmlFor={id}>{label} <span className="a-field-optional">(optional)</span></label>
        <input
          id={id}
          type="text"
          value={value[key]}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        />
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
