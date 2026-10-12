import { useState } from "react";
import { useApp } from "../state";
import { LIMITS } from "../data/limits";
import { newRequestId } from "../data/requestId";
import { useFormError } from "../ui/components";

/** An admin posts a short notice to everyone in the commune. */
export function AnnouncementNew() {
  const { hub, postAnnouncement, closeWindow, go } = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setError, message } = useFormError();
  // One id for this form, so retrying after a network failure cannot post twice.
  const [requestId] = useState(newRequestId);

  if (hub.role !== "admin") {
    return (
      <section className="a-window">
        <p className="a-window-note">Only an admin can post an announcement.</p>
        <div className="a-field-row">
          <button className="a-btn" type="button" onClick={closeWindow}>Close</button>
        </div>
      </section>
    );
  }

  const titleMissing = attempted && !title.trim();

  async function save() {
    setAttempted(true);
    if (!title.trim()) {
      document.getElementById("announcement-title")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postAnnouncement({ title, body, needsAcknowledgement, requestId });
      go("hub");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not post the announcement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="a-window">
      <div className="a-field">
        <label htmlFor="announcement-title">Title</label>
        <input
          id="announcement-title"
          value={title}
          maxLength={LIMITS.announcementTitle}
          aria-invalid={titleMissing}
          aria-describedby={titleMissing ? "announcement-title-error" : undefined}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Boiler service on Thursday"
        />
        {titleMissing ? <p className="a-form-error" role="alert" id="announcement-title-error">Add a title before posting.</p> : null}
      </div>
      <div className="a-field">
        <label htmlFor="announcement-body">Details</label>
        <textarea
          id="announcement-body"
          rows={4}
          value={body}
          maxLength={LIMITS.announcementBody}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Please be in from 8. The engineer needs the airing cupboard clear."
        />
        <span className="a-field-limit">{body.length}/{LIMITS.announcementBody}</span>
      </div>
      <label className="note-editor-pin">
        <input type="checkbox" checked={needsAcknowledgement} onChange={(event) => setNeedsAcknowledgement(event.target.checked)} />
        <span>
          Ask everyone to confirm they have seen it
          <span className="note-editor-hint">You will see who has and who has not.</span>
        </span>
      </label>
      <p className="a-window-note">Everyone in {hub.name} sees this on This Hub. It cannot be edited once posted; take it down instead.</p>
      {message()}
      <div className="a-field-row">
        <button className="a-btn" type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "Posting…" : "Post announcement"}
        </button>
        <button className="a-btn ghost" type="button" onClick={closeWindow}>Cancel</button>
      </div>
    </section>
  );
}
