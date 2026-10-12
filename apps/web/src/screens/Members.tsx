import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp, type PendingInvite } from "../state";
import { formatTimestampDay } from "../data/reminders";
import { useSearchRecord } from "../ui/useSearchRecord";
import { Avatar, Pill } from "../ui/widgets";
import { Button, Dialog, EmptyState, Feedback, Panel } from "../ui/components";

/** An invitation no one has accepted, which always carries its address. */
type OpenInvite = PendingInvite & { email: string };

/**
 * A fresh link for an invitation that is pending or has expired. Creating it
 * retires the earlier link, so the dialog asks first.
 */
function NewInviteLinkDialog({ invite, onClose, onDone }: {
  invite: OpenInvite; onClose: () => void; onDone: (message: string) => void;
}) {
  const { createInvite, sendInviteEmail } = useApp();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  async function issue() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await createInvite(invite.email, invite.role === "Admin" ? "admin" : "member");
      setUrl(result.url); setToken(result.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a new link.");
    } finally {
      setPending(false);
    }
  }
  async function email() {
    if (pending || !token) return;
    setPending(true); setError("");
    try {
      await sendInviteEmail(token);
      onDone(`New invitation emailed to ${invite.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email sending could not be confirmed. Copy the link instead.");
    } finally {
      setPending(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied.");
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }
  return (
    <Dialog title={`New invitation link for ${invite.email}`} pending={pending} onClose={url ? () => onDone(`New link ready for ${invite.email}. The earlier link no longer works.`) : onClose}>
      {!url ? (
        <>
          <p>{invite.status === "expired" ? "This invitation has expired." : "This invitation is still open."} A new link replaces it: the earlier link stops working, and the new one lasts seven days.</p>
          <Feedback error={error} />
          <div className="a-field-row">
            <Button disabled={pending} onClick={() => void issue()}>{pending ? "Creating…" : "Create new link"}</Button>
            <Button variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <div className="a-field">
            <label htmlFor="new-invite-link">New invitation link</label>
            <input id="new-invite-link" value={url} readOnly onFocus={(event) => event.target.select()} />
          </div>
          <p className="c-form-help">Only {invite.email} can accept it, after verifying their email. The earlier link no longer works.</p>
          <Feedback error={error} message={note} />
          <div className="a-field-row">
            <Button disabled={pending} onClick={() => void copy()}>Copy link</Button>
            <Button variant="secondary" disabled={pending} onClick={() => void email()}>{pending ? "Sending…" : "Email it"}</Button>
            <Button variant="secondary" disabled={pending} onClick={() => onDone(`New link ready for ${invite.email}. The earlier link no longer works.`)}>Done</Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function MembersScreen() {
  const { hub, go, session, snapshots, invites, revokeInvite, manageMember, personName } =
    useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const searchRecord = useSearchRecord("member", hub.members.map(item => item.userId));
  const [reissue, setReissue] = useState<OpenInvite | null>(null);
  const openInvites = invites.filter((invite): invite is OpenInvite =>
    (invite.status === "pending" || invite.status === "expired") && invite.email !== null);
  const pastInvites = invites.filter((invite) => invite.status === "accepted" || invite.status === "revoked").slice(0, 12);
  // Someone who accepted and has since left keeps their name, not their address.
  const invitee = (invite: PendingInvite) => invite.email ?? personName(invite.acceptedBy, "Former member");
  // Who sent an invitation. It stays open only while they are an admin.
  const sender = (invite: PendingInvite) => invite.invitedBy === session?.userId ? "you"
    : invite.invitedByName ?? (invite.invitedBy ? personName(invite.invitedBy, "a former member") : "");
  const pendingSentBy = (userId: string) =>
    openInvites.filter((invite) => invite.status === "pending" && invite.invitedBy === userId).length;
  const [action, setAction] = useState<{
    userId: string;
    name: string;
    action: "admin" | "member" | "leave" | "remove";
  } | null>(null);
  const isAdmin = hub.role === "admin";
  const former = (snapshots[hub.id]?.members ?? []).filter(
    (member) => member.active === false,
  );
  const admins = (snapshots[hub.id]?.members ?? []).filter(
    (member) => member.active !== false && member.role === "admin",
  );
  async function run(work: () => Promise<void>, success: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await work();
      setAction(null);
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update membership.",
      );
    } finally {
      setPending(false);
    }
  }
  if (!hub.id)
    return (
      <EmptyState
        title="No commune yet."
        description="Create a commune or accept an invitation to bring your people together."
      />
    );
  return (
    <>
      <div className="a-toolbar">
        <p className="c-toolbar-context">
          {hub.name} · {hub.members.length} active members
        </p>
        {isAdmin && (
          <Button onClick={() => go("member-invite")}>
            <Plus size={16} />
            Invite
          </Button>
        )}
      </div>
      <Feedback error={!action ? error || searchRecord.error : ""} message={message} />
      <Panel>
        {hub.members.map((member) => {
          const profile = snapshots[hub.id]?.members.find(
            (item) => item.userId === member.userId,
          );
          const me = member.userId === session?.userId;
          const lastAdmin = profile?.role === "admin" && admins.length <= 1;
          // Why an action is unavailable is shown, not left to a hover tooltip.
          const hintId = `member-hint-${member.userId}`;
          return (
            <div key={member.userId} id={`search-record-member-${member.userId}`} tabIndex={-1}
              className={`a-member-row c-member-row${searchRecord.highlightedId === member.userId ? " c-search-record-highlight" : ""}`}>
              <Avatar tone={member.cls} initials={member.ini} />
              <div className="who">
                <strong>{member.name}</strong>
                <span>{member.meta}</span>
              </div>
              <div
                className="bal"
                style={member.muted ? { color: "var(--ink-soft)" } : undefined}
              >
                {member.bal}
              </div>
              <div className="c-member-actions">
                {isAdmin && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={pending || lastAdmin}
                      aria-describedby={lastAdmin ? hintId : undefined}
                      onClick={() => {
                        setError("");
                        setAction({
                          userId: member.userId,
                          name: member.name,
                          action:
                            profile?.role === "admin" ? "member" : "admin",
                        });
                      }}
                    >
                      {profile?.role === "admin" ? "Make member" : "Make admin"}{" "}<span className="c-visually-hidden">{member.name}</span>
                    </Button>
                    {!me && (
                      <Button
                        variant="secondary"
                        disabled={pending || lastAdmin}
                        aria-describedby={lastAdmin ? hintId : undefined}
                        onClick={() => {
                          setError("");
                          setAction({
                            userId: member.userId,
                            name: member.name,
                            action: "remove",
                          });
                        }}
                      >
                        Remove{" "}<span className="c-visually-hidden">{member.name}</span>
                      </Button>
                    )}
                  </>
                )}
                {me && (
                  <Button
                    variant="secondary"
                    disabled={pending || lastAdmin}
                    aria-describedby={lastAdmin ? hintId : undefined}
                    onClick={() => {
                      setError("");
                      setAction({
                        userId: member.userId,
                        name: member.name,
                        action: "leave",
                      });
                    }}
                  >
                    Leave
                  </Button>
                )}
                {lastAdmin && (isAdmin || me) ? (
                  <p className="c-action-hint" id={hintId}>
                    A commune must keep an admin. Promote someone else first.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        {isAdmin &&
          openInvites.map((invite) => (
            <div key={invite.id} className="a-member-row c-member-row">
              <Avatar
                tone="house"
                initials={invite.email.slice(0, 2).toUpperCase()}
              />
              <div className="who">
                <strong>{invite.email}</strong>
                <span>
                  {invite.role} invitation ·{" "}
                  {invite.status === "expired"
                    ? `${sender(invite) ? `sent by ${sender(invite)} · ` : ""}expired ${formatTimestampDay(invite.expiresAt)}`
                    : `sent ${sender(invite) ? `by ${sender(invite)} on ` : ""}${formatTimestampDay(invite.createdAt)}, expires ${formatTimestampDay(invite.expiresAt)}`}
                </span>
              </div>
              <Pill tone={invite.status === "expired" ? undefined : "open"}>
                {invite.status === "expired" ? "Expired" : "Pending"}
              </Pill>
              <Button
                variant="secondary"
                disabled={pending}
                aria-label={`New link for ${invite.email}`}
                onClick={() => { setError(""); setMessage(""); setReissue(invite); }}
              >
                New link
              </Button>
              {invite.status === "pending" ? (
                <Button
                  variant="secondary"
                  disabled={pending}
                  aria-label={`Revoke invitation for ${invite.email}`}
                  onClick={() =>
                    void run(() => revokeInvite(invite.id), "Invitation revoked.")
                  }
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
      </Panel>
      <p className="c-form-help">
        Leaving does not erase financial records. Outstanding shares and pledges
        must be resolved, and recurring bills updated, before membership can
        end. A commune always keeps at least one admin.
      </p>
      {isAdmin && pastInvites.length > 0 && (
        <details className="c-form-help c-invite-history">
          <summary>
            {pastInvites.length} past invitation{pastInvites.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {pastInvites.map((invite) => (
              <li key={invite.id}>
                {invitee(invite)} · {invite.role.toLowerCase()} ·{" "}
                {invite.status === "accepted"
                  ? `accepted ${formatTimestampDay(invite.acceptedAt)}`
                  : `revoked ${formatTimestampDay(invite.revokedAt)}`}
                {sender(invite) ? ` · sent by ${sender(invite)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {reissue && (
        <NewInviteLinkDialog
          invite={reissue}
          onClose={() => setReissue(null)}
          onDone={(text) => { setReissue(null); setMessage(text); }}
        />
      )}
      {former.length > 0 && (
        <details className="c-form-help">
          <summary>
            {former.length} former member{former.length === 1 ? "" : "s"} ·
            history retained
          </summary>
          {former.map((member) => (
            <p key={member.userId}>{member.name} · no longer has access</p>
          ))}
        </details>
      )}
      {action && (
        <Dialog
          title={
            action.action === "leave"
              ? `Leave ${hub.name}?`
              : action.action === "remove"
                ? `Remove ${action.name}?`
                : action.action === "admin"
                  ? `Make ${action.name} an admin?`
                  : `Make ${action.name} a member?`
          }
          pending={pending}
          onClose={() => setAction(null)}
        >
          <p>
            {action.action === "admin"
              ? "Admins can invite people, manage membership, edit commune details, record expenses for others and confirm fund contributions."
              : action.action === "member"
                ? "They keep their shared records and everyday tools, but lose commune-management permissions."
                : "This ends access to the commune, not its recorded history. Unresolved balances and active recurring bills are checked on the server before anything changes."}
          </p>
          {action.action !== "admin" && pendingSentBy(action.userId) > 0 && (
            <p className="c-form-help">
              {pendingSentBy(action.userId) === 1
                ? `${action.userId === session?.userId ? "Your" : "Their"} open invitation will be withdrawn.`
                : `${action.userId === session?.userId ? "Your" : "Their"} ${pendingSentBy(action.userId)} open invitations will be withdrawn.`}
            </p>
          )}
          <Feedback error={error} />
          <div className="a-field-row">
            <Button
              disabled={pending}
              onClick={() =>
                void run(
                  () => manageMember(action.userId, action.action),
                  "Membership updated.",
                )
              }
            >
              {pending ? "Saving…" : "Confirm change"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
