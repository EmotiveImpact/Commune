import type { NoteCard } from "./household";

export function noteCategory(note: NoteCard): string {
  return note.pill === "Landlord" ? "Contacts" : note.pill;
}

export function isNotePinned(note: NoteCard): boolean {
  return (
    /\bpinned\b/i.test(note.kicker) ||
    note.facts.some(([key, value]) => key === "This Hub" && value === "Pinned")
  );
}

export function setNotePinned(note: NoteCard, pinned: boolean): NoteCard {
  const facts = note.facts.filter(([key]) => key !== "This Hub");
  if (pinned) facts.push(["This Hub", "Pinned"]);
  return { ...note, kicker: pinned ? "Pinned · everyone" : "Everyone", facts };
}

export function isSecretFact(label: string): boolean {
  return /password|passcode|door code|access code|pin code/i.test(label);
}

export function notePreview(note: NoteCard): string {
  if (note.pill === "Wi-Fi")
    return "Network and password. Open to view connection details.";
  if (note.pill === "Keys / door") return "Access details. Open to view.";
  if (noteCategory(note) === "Contacts" || note.pill === "Emergency")
    return "Contact details. Open to view.";
  // A custom/legacy note can also contain access credentials.
  if (note.facts.some(([key]) => isSecretFact(key)))
    return "Shared details. Open to view.";
  return (note.body || note.lede).slice(0, 160);
}

export function matchesNoteSearch(note: NoteCard, query: string): boolean {
  // Never index private facts or a private note's free text into board search.
  return `${note.title} ${noteCategory(note)} ${notePreview(note)}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}
