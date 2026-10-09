import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  X,
} from "lucide-react";
import type { NoteCard } from "../data/household";
import { LIMITS } from "../data/limits";
import { useApp } from "../state";
import { NoteHistory } from "../ui/NoteHistory";
import {
  isNotePinned,
  isSecretFact,
  matchesNoteSearch,
  notePreview,
  noteCategory,
  setNotePinned,
} from "../data/notePresentation";
import "./Notes.css";

const TYPE_ICONS = {
  "Wi-Fi": Wifi,
  Bins: Trash2,
  "Keys / door": KeyRound,
  Contacts: Users,
  Emergency: ShieldCheck,
  "House rules": FileText,
};
function NoteIcon({ type, size = 19 }: { type: string; size?: number }) {
  const Mark = TYPE_ICONS[type as keyof typeof TYPE_ICONS] ?? FileText;
  return <Mark size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export function NotesScreen() {
  const {
    go,
    notes,
    noteKey,
    window: win,
    hubId,
    native,
    noteSearchQuery,
    setNoteSearchQuery,
  } = useApp();
  const [filter, setFilter] = useState("All notes");
  const selected = win === "note" ? notes[noteKey] : undefined;
  const entries = Object.entries(notes).filter(
    ([, note]) =>
      (filter === "All notes" ||
        (filter === "Pinned" ? isNotePinned(note) : noteCategory(note) === filter)) &&
      matchesNoteSearch(note, noteSearchQuery),
  );
  const pinned = entries.filter(([, note]) => isNotePinned(note));
  const others = entries.filter(([, note]) => !isNotePinned(note));
  const filtered = filter !== "All notes" || Boolean(noteSearchQuery.trim());
  const clear = () => {
    setFilter("All notes");
    setNoteSearchQuery("");
  };
  function section(title: string, rows: typeof entries, primary = false) {
    if (!rows.length) return null;
    return (
      <section
        className={`notes-section${primary ? " notes-pinned" : ""}`}
        aria-label={title}
      >
        <h2>{title}</h2>
        <div className="notes-grid">
          {rows.map(([id, note]) => (
            <button
              key={id}
              type="button"
              className={`note-tile${selected && noteKey === id ? " is-selected" : ""}`}
              data-note-id={id}
              aria-pressed={Boolean(selected && noteKey === id)}
              onClick={() => go("note", { note: id })}
            >
              <span className="note-tile-icon">
                <NoteIcon type={noteCategory(note)} />
              </span>
              <span className="note-tile-copy">
                <strong>{note.title}</strong>
                <span className="note-category">{noteCategory(note)}</span>
                <span className="note-excerpt">{notePreview(note)}</span>
              </span>
              {isNotePinned(note) ? (
                <Pin className="note-pin" size={16} aria-label="Pinned" />
              ) : null}
            </button>
          ))}
        </div>
      </section>
    );
  }
  return (
    <div className={`notes-layout${selected ? " is-reading" : ""}`}>
      <div className="notes-board">
        <div className="notes-toolbar">
          <select
            aria-label="Filter notes"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              "All notes",
              "Pinned",
              "Wi-Fi",
              "Bins",
              "Keys / door",
              "Contacts",
              "Emergency",
              "House rules",
              "Other",
            ].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
          <button
            className="a-btn"
            type="button"
            onClick={() => go("note-new")}
          >
            <Plus size={16} aria-hidden="true" /> Add note
          </button>
        </div>
        <label className="notes-mobile-search c-record-filter">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search notes in this commune"
            placeholder="Filter notes…"
            maxLength={LIMITS.search}
            value={noteSearchQuery}
            onChange={(event) => setNoteSearchQuery(event.target.value)}
          />
        </label>
        {section("Pinned", pinned, true)}
        {section(pinned.length ? "More notes" : "All notes", others)}
        {!entries.length ? (
          <div className="notes-empty">
            <FileText size={30} aria-hidden="true" />
            <h2>
              {noteSearchQuery.trim()
                ? "No matching notes."
                : filter === "Pinned"
                  ? "No pinned notes."
                  : filtered
                    ? "No notes of this type."
                    : "No notes yet."}
            </h2>
            <p>
              {filtered
                ? "Try another filter or search. Your other notes are still here."
                : "Keep Wi-Fi, bin day and other shared details in one place."}
            </p>
            {filtered ? (
              <button className="a-btn ghost" onClick={clear}>
                Show all notes
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {selected ? (
        <NoteReader key={`${hubId}:${noteKey}`} note={selected} id={noteKey} />
      ) : null}
    </div>
  );
}

function NoteReader({ note, id }: { note: NoteCard; id: string }) {
  const { closeWindow, go, updateNote } = useApp();
  const panel = useRef<HTMLElement>(null);
  const close = useRef(closeWindow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pinned = isNotePinned(note);
  useEffect(() => {
    close.current = closeWindow;
  }, [closeWindow]);
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      // On mobile the reader replaces the screen. Keep keyboard focus there.
      if (
        event.key === "Tab" &&
        globalThis.matchMedia?.("(max-width: 1000px)").matches
      ) {
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        ).filter((el) => getComputedStyle(el).display !== "none");
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const card = Array.from(
        document.querySelectorAll<HTMLElement>("[data-note-id]"),
      ).find((element) => element.dataset.noteId === id);
      (opener?.isConnected ? opener : card)?.focus({ preventScroll: true });
    };
  }, [id]);
  async function togglePin() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateNote({ ...setNotePinned(note, !pinned), id });
      setNotice(pinned ? "Note unpinned." : "Note pinned on This Hub.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update the note. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  // Mask any repeated structured secret in the free-text body too.
  const safeBody = note.facts
    .filter(([label, value]) => isSecretFact(label) && value)
    .reduce((body, [, value]) => body.split(value).join("••••••••"), note.body);
  return (
    <aside
      className="note-reader"
      ref={panel}
      tabIndex={-1}
      aria-labelledby="note-reader-title"
    >
      <button className="note-back" onClick={closeWindow}>
        <ArrowLeft size={22} aria-hidden="true" />
        Notes
      </button>
      <div className="note-reader-content">
        <div className="note-reader-top">
          <span>
            <NoteIcon type={noteCategory(note)} />
            <span>{noteCategory(note)}</span>
          </span>
          <button
            className="note-close note-icon-button"
            aria-label="Close note"
            onClick={closeWindow}
          >
            <X size={22} />
          </button>
        </div>
        <h2 id="note-reader-title">{note.title}</h2>
        {pinned ? (
          <p className="note-pin-status">
            <Pin size={18} aria-hidden="true" />
            Pinned on the notes board
          </p>
        ) : null}
        <dl className="note-details">
          {note.facts
            .filter(
              ([label, value]) =>
                value && !["Who can see", "This Hub"].includes(label),
            )
            .map(([label, value], index) => (
              <NoteFact
                key={`${label}:${index}:${value}`}
                label={label}
                value={value}
              />
            ))}
        </dl>
        {safeBody ? (
          <div className="note-body">
            <h3>{note.pill === "Wi-Fi" ? "Connection notes" : "Notes"}</h3>
            <p>{safeBody}</p>
          </div>
        ) : null}
        <div className="note-reader-actions">
          <button
            className="a-btn"
            disabled={saving}
            onClick={() => go("note-edit", { note: id })}
          >
            Edit note
          </button>
          <button
            className="note-text-button"
            disabled={saving}
            onClick={() => void togglePin()}
          >
            {saving ? "Saving…" : pinned ? "Unpin" : "Pin note"}
          </button>
        </div>
        {error ? (
          <p className="a-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="note-feedback" role="status">
          {notice}
        </p>
        <NoteHistory noteId={id} />
        <p className="note-visibility">
          <Users size={20} aria-hidden="true" />
          Visible to commune members
        </p>
      </div>
    </aside>
  );
}

function NoteFact({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const secret = isSecretFact(label);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError("Could not copy. Select and copy the text instead.");
    }
  }
  return (
    <div className="note-fact">
      <div className="note-fact-text">
        <dt>{label}</dt>
        <dd>{secret && !revealed ? "••••••••••" : value}</dd>
      </div>
      <div className="note-fact-actions">
        {secret ? (
          <button
            className="note-icon-button"
            aria-label={`${revealed ? "Hide" : "Reveal"} ${label.toLowerCase()}`}
            aria-pressed={revealed}
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        ) : null}
        <button
          className="note-icon-button"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => void copy()}
        >
          <Copy size={19} />
        </button>
      </div>
      {secret ? <small>Only reveal when you need it.</small> : null}
      {copied ? <small role="status">{label} copied.</small> : null}
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}
