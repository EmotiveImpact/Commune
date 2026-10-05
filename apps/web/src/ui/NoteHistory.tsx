import { useState } from "react";
import { useApp } from "../state";
import type { NoteRevision } from "../live/model";
import { formatTimestampDay } from "../data/reminders";
import { isSecretFact } from "../data/notePresentation";

function maskSecrets(body: string, facts: Array<[string, string]>): string {
  return facts.filter(([label, value]) => isSecretFact(label) && value)
    .reduce((text, [, value]) => text.split(value).join("••••••••"), body);
}

/** Earlier versions of a note: read any of them, or restore one as the newest. */
export function NoteHistory({ noteId }: { noteId: string }) {
  const { notes, hub, loadNoteRevision, updateNote } = useApp();
  const note = notes[noteId];
  const [open, setOpen] = useState<NoteRevision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const revisions = note?.revisions ?? [];
  if (!note || !revisions.length) return null;
  const name = (userId: string | null | undefined) => hub.members.find((member) => member.userId === userId)?.name ?? "a former member";
  async function view(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      setOpen(await loadNoteRevision(noteId, id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that version.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(revision: NoteRevision) {
    setBusy(true); setError("");
    try {
      await updateNote({ id: noteId, expectedVersion: note.version, title: revision.title, pill: revision.pill, kicker: revision.kicker,
        lede: revision.lede, body: revision.body, facts: revision.facts });
      setOpen(null);
      setMessage(`Version ${revision.version} restored as the newest version. Nothing was deleted.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore that version.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="c-contribution-history c-note-history">
      <summary>Version {note.version ?? 1}{note.updatedBy ? ` · saved by ${name(note.updatedBy)}` : ""} · {revisions.length} earlier {revisions.length === 1 ? "version" : "versions"}</summary>
      {revisions.map((revision) => (
        <div key={revision.id}>
          <span><strong>Version {revision.version}</strong> · “{revision.title}” · saved by {name(revision.editedBy)} on {formatTimestampDay(revision.editedAt)}</span>
          <button className="a-btn ghost" type="button" disabled={busy} onClick={() => void view(revision.id)}>View</button>
        </div>
      ))}
      {open ? (
        <div className="c-note-revision" aria-label={`Version ${open.version}`}>
          <strong>{open.title}</strong>
          {/* Earlier passwords and codes stay masked here, as on the board. */}
          {open.facts.filter(([key, value]) => value && !["Who can see", "This Hub"].includes(key))
            .map(([key, value], index) => <p key={`${key}:${index}`}><span>{key}</span> {isSecretFact(key) ? "••••••••" : value}</p>)}
          {open.body ? <p>{maskSecrets(open.body, open.facts)}</p> : null}
          <div className="a-field-row">
            <button className="a-btn" type="button" disabled={busy} onClick={() => void restore(open)}>Restore version {open.version}</button>
            <button className="a-btn ghost" type="button" disabled={busy} onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="a-form-error" role="alert">{error}</p> : null}
      {message ? <p className="a-window-note" role="status">{message}</p> : null}
    </details>
  );
}

