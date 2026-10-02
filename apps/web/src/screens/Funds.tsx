import { useState, type FormEvent } from "react";
import { HandCoins, Plus } from "lucide-react";
import { useApp } from "../state";
import { useSearchRecord } from "../ui/useSearchRecord";
import { money, type Fund, type Commitment } from "../live/model";
import { parseMoneyInput } from "../data/moneyInput";
import { todayIso } from "../data/operations";
import {
  Button,
  Dialog,
  EmptyState,
  Feedback,
  Field,
  Panel,
  SectionHeading,
} from "../ui/components";
import { Pill } from "../ui/widgets";
import { ReminderConfirm } from "../ui/ReminderConfirm";
import {
  RecipientReminderCount,
  reminderLimitReached,
} from "../ui/ReminderUsage";

type Mode =
  | { kind: "create" }
  | { kind: "view" | "edit" | "archive"; fundId: string }
  | { kind: "pledge"; fundId: string; commitmentId?: string }
  | { kind: "contribute" | "cancel"; fundId: string; commitmentId: string }
  | { kind: "void"; fundId: string; contributionId: string };

export function FundsScreen() {
  const {
    hub,
    session,
    funds,
    reminderTargets,
    reminderUsage,
    createFund,
    updateFund,
    archiveFund,
    pledgeFund,
    updatePledge,
    recordFundContribution,
    voidContribution,
    sendReminder,
    go,
  } = useApp();
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chase, setChase] = useState<{
    id: string;
    name: string;
    subject: string;
    amount: string;
  } | null>(null);
  const isAdmin = hub.role === "admin";
  const searchRecord = useSearchRecord("fund", funds.filter(item => !item.archivedAt).map(item => item.id),
    id => { setShowArchived(false); setMode({ kind: "view", fundId: id }); });
  const fund =
    mode && "fundId" in mode
      ? funds.find((item) => item.id === mode.fundId)
      : undefined;
  const commitment =
    mode && "commitmentId" in mode
      ? fund?.commitments.find((item) => item.id === mode.commitmentId)
      : undefined;
  const contribution =
    mode?.kind === "void"
      ? fund?.commitments
          .flatMap((item) => item.contributions ?? [])
          .find((item) => item.id === mode.contributionId)
      : undefined;

  function open(next: Mode) {
    setError("");
    setMessage("");
    setMode(next);
    setName("");
    setAmount("");
    setDate(todayIso());
    setReason("");
    const target =
      "fundId" in next
        ? funds.find((item) => item.id === next.fundId)
        : undefined;
    if (next.kind === "edit" && target) {
      setName(target.name);
      setAmount(
        target.targetMinor ? (target.targetMinor / 100).toFixed(2) : "",
      );
    }
    if (next.kind === "pledge" && next.commitmentId && target) {
      const pledge = target.commitments.find(
        (item) => item.id === next.commitmentId,
      );
      if (pledge) {
        setAmount((pledge.amountMinor / 100).toFixed(2));
        setDate(pledge.dueOn);
      }
    }
    if (next.kind === "contribute" && target) {
      const pledge = target.commitments.find(
        (item) => item.id === next.commitmentId,
      );
      if (pledge)
        setAmount(
          ((pledge.amountMinor - pledge.contributedMinor) / 100).toFixed(2),
        );
    }
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMode(null);
      setChase(null);
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the change.",
      );
    } finally {
      setPending(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!mode) return;
    const minor = parseMoneyInput(amount);
    if (mode.kind === "create" || mode.kind === "edit") {
      if (!name.trim() || (amount.trim() && !minor)) {
        setError("Enter a name and a valid optional target.");
        return;
      }
      void run(
        () =>
          mode.kind === "create"
            ? createFund(name.trim(), minor)
            : updateFund(mode.fundId, name.trim(), minor),
        "Fund saved.",
      );
    } else if (mode.kind === "pledge") {
      if (!minor || !date) {
        setError("Enter a valid amount and due date.");
        return;
      }
      void run(
        () =>
          mode.commitmentId
            ? updatePledge(mode.commitmentId, {
                amountMinor: minor,
                dueOn: date,
              })
            : pledgeFund(mode.fundId, minor, date),
        "Your pledge was saved.",
      );
    } else if (mode.kind === "contribute" && commitment) {
      if (
        !minor ||
        minor > commitment.amountMinor - commitment.contributedMinor
      ) {
        setError("Enter an amount no greater than the outstanding pledge.");
        return;
      }
      void run(
        () => recordFundContribution(mode.commitmentId, minor),
        "Contribution recorded. No payment was taken by Commune.",
      );
    } else if (mode.kind === "void") {
      if (reason.trim().length < 3) {
        setError("Enter a correction reason (at least 3 characters).");
        return;
      }
      void run(
        () => voidContribution(mode.contributionId, reason.trim()),
        "Contribution corrected. Its original record and reason are retained.",
      );
    }
  }
  // Render inline, not as a new component type on every state change: a Chase
  // dialog must be able to return keyboard focus to the same pledge button.
  function renderPledge(pledge: Commitment) {
    const member = hub.members.find((item) => item.userId === pledge.userId);
    const remaining = pledge.amountMinor - pledge.contributedMinor;
    const isMine = pledge.userId === session?.userId;
    const target = reminderTargets.find(
      (item) => item.kind === "chase" && item.sourceId === pledge.id,
    );
    const cooldown =
      !!target?.lastSentAt &&
      Date.now() - Date.parse(target.lastSentAt) < 72 * 60 * 60 * 1000;
    const quota = reminderLimitReached(reminderUsage, pledge.userId);
    return (
      <div className="c-pledge-row" key={pledge.id}>
        <div className="c-pledge-head">
          <div>
            <strong>
              {member?.name ?? "Former member"}
              {isMine ? " (you)" : ""}
            </strong>
            <small>
              Pledged {money(pledge.amountMinor, hub.currency)} · due{" "}
              {pledge.dueOn}
            </small>
          </div>
          <Pill
            tone={
              pledge.cancelledAt ? "open" : remaining > 0 ? "open" : "settled"
            }
          >
            {pledge.cancelledAt
              ? "Cancelled"
              : remaining > 0
                ? `${money(remaining, hub.currency)} due`
                : "Contributed"}
          </Pill>
        </div>
        {!pledge.cancelledAt && !fund?.archivedAt && (
          <div className="a-field-row">
            {isAdmin && remaining > 0 && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  open({
                    kind: "contribute",
                    fundId: fund!.id,
                    commitmentId: pledge.id,
                  })
                }
              >
                Record contribution
              </Button>
            )}
            {isAdmin && target && !isMine && (
              <Button
                variant="secondary"
                disabled={pending || cooldown || quota}
                onClick={() => {
                  setError("");
                  setChase({
                    id: pledge.id,
                    name: member?.name ?? "Member",
                    subject: fund!.name,
                    amount: money(remaining, hub.currency),
                  });
                }}
              >
                Chase{cooldown ? " · cooldown" : ""}
              </Button>
            )}
            {(isMine || isAdmin) && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  open({
                    kind: "pledge",
                    fundId: fund!.id,
                    commitmentId: pledge.id,
                  })
                }
              >
                Edit pledge
              </Button>
            )}
            {(isMine || isAdmin) && !pledge.contributedMinor && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  open({
                    kind: "cancel",
                    fundId: fund!.id,
                    commitmentId: pledge.id,
                  })
                }
              >
                Cancel pledge
              </Button>
            )}
          </div>
        )}
        {isAdmin && target && (
          <RecipientReminderCount
            usage={reminderUsage}
            recipientId={pledge.userId}
          />
        )}
        {(pledge.contributions ?? []).length > 0 && (
          <details className="c-contribution-history">
            <summary>
              {money(pledge.contributedMinor, hub.currency)} recorded ·
              contribution history
            </summary>
            {pledge.contributions!.map((entry) => (
              <div key={entry.id}>
                <span>
                  {money(entry.amountMinor, hub.currency)} ·{" "}
                  {new Date(entry.contributedAt).toLocaleDateString("en-GB")}
                  {entry.voidedAt ? ` · corrected: ${entry.voidReason}` : ""}
                </span>
                {isAdmin && !entry.voidedAt && !fund?.archivedAt && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      open({
                        kind: "void",
                        fundId: fund!.id,
                        contributionId: entry.id,
                      })
                    }
                  >
                    Correct
                  </Button>
                )}
              </div>
            ))}
          </details>
        )}
      </div>
    );
  }
  if (!hub.id)
    return (
      <EmptyState
        title="Create a commune first."
        description="Funds belong to a commune and its members."
        action={
          <Button onClick={() => go("commune-new")}>Create a commune</Button>
        }
      />
    );
  const visible = funds.filter((item) =>
    showArchived ? !!item.archivedAt : !item.archivedAt,
  );
  return (
    <>
      <div className="a-toolbar">
        <div className="a-filters">
          <button
            className={`a-chip${!showArchived ? " is-on" : ""}`}
            type="button"
            aria-pressed={!showArchived}
            onClick={() => setShowArchived(false)}
          >
            Active
          </button>
          <button
            className={`a-chip${showArchived ? " is-on" : ""}`}
            type="button"
            aria-pressed={showArchived}
            onClick={() => setShowArchived(true)}
          >
            Archived
          </button>
        </div>
        {isAdmin && (
          <Button onClick={() => open({ kind: "create" })}>
            <Plus size={16} />
            Create fund
          </Button>
        )}
      </div>
      <Feedback error={!mode && !chase ? error || searchRecord.error : ""} message={message} />
      {!visible.length && (
        <EmptyState
          title={
            showArchived
              ? "No archived funds."
              : "A shared goal, without the guesswork."
          }
          description={
            showArchived
              ? "Completed funds can be archived without losing their records."
              : isAdmin
                ? "Create a fund, let people pledge, and record contributions when they arrive. Commune does not hold the money."
                : "An admin can set up a fund for this commune. You choose your own pledge."
          }
        />
      )}
      <div className="c-workflow-grid">
        {visible.map((item) => {
          const pledges = item.commitments.filter(
            (pledge) => !pledge.cancelledAt,
          );
          const my = pledges.find(
            (pledge) => pledge.userId === session?.userId,
          );
          return (
            <Panel className={`c-workflow-card${searchRecord.highlightedId === item.id ? " c-search-record-highlight" : ""}`}
              id={`search-record-fund-${item.id}`} tabIndex={-1} label={item.name} key={item.id}>
              <SectionHeading
                title={item.name}
                action={
                  <HandCoins
                    size={18}
                    strokeWidth={1.5}
                    className="c-muted-icon"
                    aria-hidden="true"
                  />
                }
              />
              <span className="c-metric-label">Recorded contributions</span>
              <strong className="c-workflow-amount">
                {money(item.contributedMinor, hub.currency)}
              </strong>
              <p className="c-form-help">
                {item.targetMinor
                  ? `Target ${money(item.targetMinor, hub.currency)}`
                  : "No target"}{" "}
                · {pledges.length} pledge{pledges.length === 1 ? "" : "s"}
              </p>
              {item.targetMinor && (
                <div className="c-fund-progress">
                  <div
                    role="progressbar"
                    aria-label={`${item.name} target progress`}
                    aria-valuemin={0}
                    aria-valuemax={item.targetMinor}
                    aria-valuenow={Math.min(
                      item.contributedMinor,
                      item.targetMinor,
                    )}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (item.contributedMinor / item.targetMinor) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {my && (
                <p className="c-form-help">
                  Your pledge: {money(my.amountMinor, hub.currency)} ·{" "}
                  {money(
                    Math.max(0, my.amountMinor - my.contributedMinor),
                    hub.currency,
                  )}{" "}
                  remaining
                </p>
              )}
              <div className="a-field-row">
                <Button
                  variant="secondary"
                  onClick={() => open({ kind: "view", fundId: item.id })}
                >
                  View fund
                </Button>
                {!my && !item.archivedAt && (
                  <Button
                    onClick={() => open({ kind: "pledge", fundId: item.id })}
                  >
                    Make a pledge
                  </Button>
                )}
                {item.archivedAt && isAdmin && (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () => archiveFund(item.id, false),
                        "Fund restored.",
                      )
                    }
                  >
                    Restore
                  </Button>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      {mode && (
        <Dialog
          key={`${mode.kind}-${"fundId" in mode ? mode.fundId : "new"}`}
          title={
            mode.kind === "create"
              ? "Create a fund"
              : mode.kind === "view"
                ? (fund?.name ?? "Fund")
                : mode.kind === "edit"
                  ? "Edit fund"
                  : mode.kind === "pledge"
                    ? mode.commitmentId
                      ? "Edit pledge"
                      : "Make a pledge"
                    : mode.kind === "contribute"
                      ? "Record contribution"
                      : mode.kind === "void"
                        ? "Correct a contribution"
                        : mode.kind === "cancel"
                          ? "Cancel this pledge?"
                          : "Archive this fund?"
          }
          pending={pending}
          onClose={() => setMode(null)}
        >
          {mode.kind === "view" && fund ? (
            <>
              <p className="c-form-help">
                {money(fund.contributedMinor, hub.currency)} recorded
                {fund.targetMinor
                  ? ` of ${money(fund.targetMinor, hub.currency)}`
                  : ""}
                . These are confirmations, not money held by Commune.
              </p>
              {fund.commitments.map(renderPledge)}
              {!fund.commitments.length && (
                <p className="c-form-help">No pledges yet.</p>
              )}
              {!fund.archivedAt && (
                <div className="a-field-row">
                  {!fund.commitments.some(
                    (pledge) =>
                      pledge.userId === session?.userId && !pledge.cancelledAt,
                  ) && (
                    <Button
                      onClick={() => open({ kind: "pledge", fundId: fund.id })}
                    >
                      Make a pledge
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => open({ kind: "edit", fundId: fund.id })}
                      >
                        Edit fund
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          open({ kind: "archive", fundId: fund.id })
                        }
                      >
                        Archive
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : mode.kind === "archive" && fund ? (
            <>
              <p>
                Move {fund.name} out of the active list. Its contribution
                history stays saved and you can restore it later.
              </p>
              <p className="c-form-help">
                Outstanding pledges must be contributed or cancelled first.
              </p>
              <Feedback error={error} />
              <div className="a-field-row">
                <Button
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => archiveFund(fund.id, true),
                      "Fund archived. Its records are preserved.",
                    )
                  }
                >
                  Archive fund
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setMode(null)}
                >
                  Keep active
                </Button>
              </div>
            </>
          ) : mode.kind === "cancel" && commitment ? (
            <>
              <p>
                Cancel the {money(commitment.amountMinor, hub.currency)} pledge?
                It will no longer be due or eligible for Chase. Its record stays
                in the fund’s history.
              </p>
              <Feedback error={error} />
              <div className="a-field-row">
                <Button
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => updatePledge(commitment.id, { cancel: true }),
                      "Pledge cancelled.",
                    )
                  }
                >
                  Cancel pledge
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setMode(null)}
                >
                  Keep pledge
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={save}>
              <fieldset className="c-form-fields" disabled={pending}>
                {(mode.kind === "create" || mode.kind === "edit") && (
                  <Field label="Fund name">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  </Field>
                )}
                {mode.kind !== "void" && (
                  <Field
                    label={`${mode.kind === "create" || mode.kind === "edit" ? "Target (optional)" : mode.kind === "contribute" ? "Contribution received" : "Pledge amount"} (${hub.currency})`}
                  >
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="decimal"
                      maxLength={14}
                      required={mode.kind !== "create" && mode.kind !== "edit"}
                    />
                  </Field>
                )}
                {mode.kind === "pledge" && (
                  <Field label="Due date">
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </Field>
                )}
                {mode.kind === "contribute" && (
                  <p className="c-form-help">
                    Confirm only money actually received outside Commune.{" "}
                    {commitment
                      ? money(
                          commitment.amountMinor - commitment.contributedMinor,
                          hub.currency,
                        )
                      : ""}{" "}
                    remains outstanding.
                  </p>
                )}
                {mode.kind === "void" && (
                  <>
                    <p>
                      Mark{" "}
                      {contribution
                        ? money(contribution.amountMinor, hub.currency)
                        : "this entry"}{" "}
                      as recorded in error. This reopens that amount on the
                      pledge; it does not refund a payment.
                    </p>
                    <Field label="Correction reason">
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        minLength={3}
                        maxLength={240}
                        required
                      />
                    </Field>
                  </>
                )}
              </fieldset>
              <Feedback error={error} />
              <div className="a-field-row">
                <Button type="submit" disabled={pending}>
                  {pending
                    ? "Saving…"
                    : mode.kind === "contribute"
                      ? "Confirm contribution"
                      : mode.kind === "void"
                        ? "Save correction"
                        : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}
      {chase && (
        <ReminderConfirm
          {...chase}
          remaining={
            reminderUsage
              ? Math.max(0, reminderUsage.totalLimit - reminderUsage.totalUsed)
              : null
          }
          pending={pending}
          error={error}
          onClose={() => setChase(null)}
          onSend={() =>
            void run(
              () => sendReminder("chase", chase.id),
              "Chase sent in Commune.",
            )
          }
        />
      )}
    </>
  );
}
