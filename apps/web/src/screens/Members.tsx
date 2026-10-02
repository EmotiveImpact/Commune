import { useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "../state";
import { useSearchRecord } from "../ui/useSearchRecord";
import { Avatar, Pill } from "../ui/widgets";
import { Button, Dialog, EmptyState, Feedback, Panel } from "../ui/components";

export function MembersScreen() {
  const { hub, go, session, snapshots, invites, revokeInvite, manageMember } =
    useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const searchRecord = useSearchRecord("member", hub.members.map(item => item.userId));
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
                      title={
                        lastAdmin
                          ? "Promote another member before changing the last admin"
                          : undefined
                      }
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
                      {profile?.role === "admin" ? "Make member" : "Make admin"}
                    </Button>
                    {!me && (
                      <Button
                        variant="secondary"
                        disabled={pending || lastAdmin}
                        onClick={() => {
                          setError("");
                          setAction({
                            userId: member.userId,
                            name: member.name,
                            action: "remove",
                          });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </>
                )}
                {me && (
                  <Button
                    variant="secondary"
                    disabled={pending || lastAdmin}
                    title={
                      lastAdmin
                        ? "A commune must keep an admin. Promote someone else first."
                        : undefined
                    }
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
              </div>
            </div>
          );
        })}
        {isAdmin &&
          invites.map((invite) => (
            <div key={invite.id} className="a-member-row c-member-row">
              <Avatar
                tone="house"
                initials={invite.email.slice(0, 2).toUpperCase()}
              />
              <div className="who">
                <strong>{invite.email}</strong>
                <span>{invite.role} invitation · pending acceptance</span>
              </div>
              <Pill tone="open">Pending</Pill>
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
            </div>
          ))}
      </Panel>
      <p className="c-form-help">
        Leaving does not erase financial records. Outstanding shares and pledges
        must be resolved, and recurring bills updated, before membership can
        end. A commune always keeps at least one admin.
      </p>
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
