import { useRef, useState, type ChangeEvent } from "react";
import { readImageFile } from "../data/images";
import { cx } from "./cx";

export function ImagePick({
  label,
  clearLabel,
  hasCustom,
  maxEdge,
  onPhoto,
  onClear,
  tone = "plain",
  inputLabel,
}: {
  label: string;
  clearLabel: string;
  hasCustom: boolean;
  maxEdge: number;
  onPhoto: (dataUrl: string) => void;
  onClear: () => void;
  tone?: "plain" | "on-photo";
  inputLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onPhotoButton = tone === "on-photo";

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onPhoto(await readImageFile(file, maxEdge));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t read that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("a-photo-bar", onPhotoButton && "is-on-photo")}>
      <button
        className={onPhotoButton ? "a-photo-btn" : "a-btn ghost"}
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Reading…" : label}
      </button>
      {hasCustom ? (
        <button
          className={onPhotoButton ? "a-photo-btn" : "a-btn ghost"}
          type="button"
          onClick={() => {
            setError("");
            onClear();
          }}
        >
          {clearLabel}
        </button>
      ) : null}
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label={inputLabel}
        onChange={(event) => void onChange(event)}
      />
      {error ? <span className="a-photo-error">{error}</span> : null}
    </div>
  );
}
