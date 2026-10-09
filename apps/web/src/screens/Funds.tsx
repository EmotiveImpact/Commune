import { useEffect, useRef, useState, type FormEvent } from "react";
import { fundFigures } from "../data/funds";
import { HandCoins, Plus } from "lucide-react";
import { useApp } from "../state";
import { money, type Fund, type Commitment } from "../live/model";
import { moneyInputError, parseMoneyInput } from "../data/moneyInput";
import { LIMITS } from "../data/limits";
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
import { ReminderFlowDialog, useReminderFlow } from "../ui/ReminderConfirm";
import { RecipientReminderCount } from "../ui/ReminderUsage";
import { formatReminderDay, reminderEligibility } from "../data/reminders";
import { newRequestId } from "../data/requestId";
import { commandFailure, UNCERTAIN_RETRY_SAFE } from "../data/commands";

type Mode =
  | { kind: "create" }
  | { kind: "view" | "edit" | "archive"; fundId: string }
  | { kind: "pledge"; fundId: string; commitmentId?: string }
  | { kind: "contribute" | "cancel"; fundId: string; commitmentId: string }
  | { kind: "void"; fundId: string; contributionId: string };

/** Promised, received, still to come and (with a target) not yet pledged. */
function FundFigures({ fund }: { fund: Fund }) {
  const { hub } = useApp();
  const figures = fundFigures(fund);
  const cells: Array<[string, number]> = [
    ["Promised", figures.promisedMinor],
    ["Received", figures.receivedMinor],
    ["Still to come", figures.stillToComeMinor],
  ];
  if (figures.unpledgedMinor !== null) cells.push(["Not yet pledged", figures.unpledgedMinor]);
  return (
    <dl className="c-fund-figures">
      {cells.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{money(value, hub.currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FundsScreen() {
  const {
    hub,
    session,
    snapshots,
    funds,
    reminderTargets,
    reminderUsage,
    sentReminders,
    createFund,
    updateFund,
    archiveFund,
    pledgeFund,
    updatePledge,
    recordFundContribution,
    voidContribution,
    sendReminder,
    go,
    fundKey,
    closeWindow,
    contentLoading,
    personName,
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
  // One id per opened dialog: every retry of a create reuses it, so the server
  // records the fund, pledge or contribution once. After an unconfirmed
  // attempt the fields lock, so a retry is the same request.
  const requestId = useRef(newRequestId());
  const [uncertain, setUncertain] = useState(false);
  // The pledge as the edit or cancel dialog opened it. The change is refused
  // if the pledge no longer looks like this, so it cannot undo someone else's.
  const [base, setBase] = useState<{ amountMinor: number; dueOn: string } | null>(null);
  const [rebase, setRebase] = useState(false);
  const chase = useReminderFlow(sendReminder);
  const isAdmin = hub.role === "admin";
  // Money towards an admin's own pledge is confirmed by another admin when the
  // commune has one; the database refuses it otherwise.
  const anotherAdmin = (snapshots[hub.id]?.members ?? []).some((member) =>
    member.active !== false && member.role === "admin" && member.userId !== session?.userId);
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
  // On someone else's pledge an admin may only lower it, move it later or
  // cancel it; only the pledger can raise it or bring it forward.
  const othersPledge = !!commitment && commitment.userId !== session?.userId;
  const pledgerMember = commitment
    ? hub.members.find((item) => item.userId === commitment.userId)
    : undefined;
  const pledger = commitment ? personName(commitment.userId, "the person who made it") : "the person who made it";
  const recorded = commitment?.contributedMinor ? money(commitment.contributedMinor, hub.currency) : "";
  const pledgeAmountHint = !commitment ? undefined
    : othersPledge ? `Up to ${money(commitment.amountMinor, hub.currency)}${recorded ? `, and not below the ${recorded} already recorded` : ""}.`
      : recorded ? `Not below the ${recorded} already recorded.` : undefined;
  // After a conflict the fund has been reloaded: start the dialog again from
  // the pledge as it is now, so the next change is based on it.
  useEffect(() => {
    if (!rebase) return;
    setRebase(false);
    if (!commitment) return;
    setBase({ amountMinor: commitment.amountMinor, dueOn: commitment.dueOn });
    if (mode?.kind === "pledge") {
      setAmount((commitment.amountMinor / 100).toFixed(2));
      setDate(commitment.dueOn);
    }
  }, [rebase, commitment, mode]);

  // A fund's address opens it: a link, a reload, Back to it, a search result
  // or a notice. Leaving the address closes its view; a form opened from the
  // view stays until it is finished.
  const [highlightedId, setHighlightedId] = useState("");
  const [missingFund, setMissingFund] = useState("");
  const opened = useRef("");
  useEffect(() => {
    if (!fundKey) {
      opened.current = "";
      setMissingFund("");
      setMode((current) => current?.kind === "view" ? null : current);
      return;
    }
    if (contentLoading || opened.current === fundKey) return;
    opened.current = fundKey;
    // Opened with View fund on this screen: already showing.
    if (mode && "fundId" in mode && mode.fundId === fundKey) return;
    const target = funds.find((item) => item.id === fundKey);
    if (!target) {
      setMissingFund("That fund isn’t in this commune. It may have been removed.");
      return;
    }
    setShowArchived(Boolean(target.archivedAt));
    setHighlightedId(fundKey);
    const card = document.getElementById(`search-record-fund-${fundKey}`);
    card?.scrollIntoView({ block: "center" });
    card?.focus();
    open({ kind: "view", fundId: fundKey });
  }, [contentLoading, fundKey, funds]);
  // Closing the fund's dialogs leaves its address.
  const shownMode = useRef<Mode | null>(null);
  useEffect(() => {
    const was = shownMode.current;
    shownMode.current = mode;
    if (was && !mode && fundKey && opened.current === fundKey) closeWindow();
  }, [mode]);

  function open(next: Mode) {
    setError("");
    setMessage("");
    setUncertain(false);
    requestId.current = newRequestId();
    setBase(null);
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
        setBase({ amountMinor: pledge.amountMinor, dueOn: pledge.dueOn });
      }
    }
    if (next.kind === "cancel" && target) {
      const pledge = target.commitments.find((item) => item.id === next.commitmentId);
      if (pledge) setBase({ amountMinor: pledge.amountMinor, dueOn: pledge.dueOn });
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
  /**
   * retryCheck: a create carries this dialog's request id, so trying again is
   * safe; it names where to look if an earlier attempt may have saved.
   * rebaseOnConflict: a pledge that changed meanwhile restarts the dialog.
   */
  async function run(action: () => Promise<unknown>, success: string,
    options: { retryCheck?: string; rebaseOnConflict?: boolean } = {}) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMode(null);
      setMessage(success);
    } catch (cause) {
      const failure = commandFailure(cause, "Could not save the change.");
      if (!options.retryCheck) {
        if (options.rebaseOnConflict && failure.conflict) setRebase(true);
        setError(
          cause instanceof Error ? cause.message : "Could not save the change.",
        );
        return;
      }
      if (!failure.rejected) setUncertain(true);
      // Once an attempt may have saved, a later refusal does not mean nothing was.
      setError(!failure.rejected ? UNCERTAIN_RETRY_SAFE
        : uncertain || /already used for a different/i.test(failure.message)
          ? `An earlier attempt may already have been saved. Close this and check ${options.retryCheck} before adding it again.`
          : `${failure.message.replace(/\.$/, "")}. Nothing was saved.`);
    } finally {
      setPending(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!mode) return;
    const minor = parseMoneyInput(amount, hub.currency);
    if (mode.kind === "create" || mode.kind === "edit") {
      if (!name.trim() || (amount.trim() && !minor)) {
        setError(moneyInputError(amount, hub.currency, "Enter a name and a valid optional target."));
        return;
      }
      void run(
        () =>
          mode.kind === "create"
            ? createFund(name.trim(), minor, requestId.current)
            : updateFund(mode.fundId, name.trim(), minor),
        "Fund saved.",
        { retryCheck: mode.kind === "create" ? "Funds" : undefined },
      );
    } else if (mode.kind === "pledge") {
      if (!minor || !date) {
        setError(moneyInputError(amount, hub.currency, "Enter a valid amount and due date."));
        return;
      }
      if (commitment && minor < commitment.contributedMinor) {
        setError(`${money(commitment.contributedMinor, hub.currency)} is already recorded, so the pledge cannot be lower than that.`);
        return;
      }
      if (othersPledge && commitment && minor > commitment.amountMinor) {
        setError(`Only ${pledger} can raise this pledge. Enter ${money(commitment.amountMinor, hub.currency)} or less.`);
        return;
      }
      if (othersPledge && commitment && date < commitment.dueOn) {
        setError(`Only ${pledger} can bring the due date forward. Choose ${formatReminderDay(commitment.dueOn)} or later.`);
        return;
      }
      void run(
        () =>
          mode.commitmentId
            ? updatePledge(mode.commitmentId, {
                amountMinor: minor,
                dueOn: date,
                expectedAmountMinor: base?.amountMinor,
                expectedDueOn: base?.dueOn,
              })
            : pledgeFund(mode.fundId, minor, date, requestId.current),
        othersPledge ? "Pledge saved." : "Your pledge was saved.",
        mode.commitmentId ? { rebaseOnConflict: true } : { retryCheck: "the fund" },
      );
    } else if (mode.kind === "contribute" && commitment) {
      if (
        !minor ||
        minor > commitment.amountMinor - commitment.contributedMinor
      ) {
        setError(moneyInputError(amount, hub.currency, "Enter an amount no greater than the outstanding pledge."));
        return;
      }
      void run(
        () => recordFundContribution(mode.commitmentId, minor, requestId.current),
        "Contribution recorded. No payment was taken by Commune.",
        { retryCheck: "the fund" },
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
    const remaining = pledge.amountMinor - pledge.contributedMinor;
    const isMine = pledge.userId === session?.userId;
    const target = reminderTargets.find(
      (item) => item.kind === "chase" && item.sourceId === pledge.id,
    );
    const eligibility = reminderEligibility({
      kind: "chase",
      recipientId: pledge.userId,
      target,
      usage: reminderUsage,
      sent: sentReminders,
      dueOn: pledge.dueOn,
    });
    return (
      <div className="c-pledge-row" key={pledge.id}>
        <div className="c-pledge-head">
          <div>
            <strong>
              {personName(pledge.userId, "Former member", { left: true })}
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
            {isAdmin && remaining > 0 && !(isMine && anotherAdmin) && (
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
                disabled={pending || !eligibility.canSend}
                title={eligibility.reason || undefined}
                onClick={() => {
                  setError("");
                  setMessage("");
                  chase.open({
                    kind: "chase",
                    sourceId: pledge.id,
                    recipientId: pledge.userId,
                    name: personName(pledge.userId, "Member"),
                    subject: fund!.name,
                    amount: money(remaining, hub.currency),
                    dueOn: pledge.dueOn,
                  });
                }}
              >
                Chase{eligibility.state === "cooldown" ? " · cooldown" : ""}
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
        {isAdmin && target && !isMine && eligibility.reason && (
          <p className="c-action-hint">{eligibility.reason}</p>
        )}
        {isAdmin && isMine && anotherAdmin && remaining > 0 && !pledge.cancelledAt && !fund?.archivedAt && (
          <p className="c-action-hint">Another admin records what you contribute to your own pledge.</p>
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
      <Feedback error={!mode && !chase.request ? error || missingFund : ""} message={message} />
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
            <Panel className={`c-workflow-card${highlightedId === item.id ? " c-search-record-highlight" : ""}`}
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
              <FundFigures fund={item} />
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
                  onClick={() => {
                    open({ kind: "view", fundId: item.id });
                    go("funds", { fund: item.id });
                  }}
                >
                  View fund{" "}<span className="c-visually-hidden">{item.name}</span>
                </Button>
                {!my && !item.archivedAt && (
                  <Button
                    onClick={() => open({ kind: "pledge", fundId: item.id })}
                  >
                    Make a pledge{" "}<span className="c-visually-hidden">to {item.name}</span>
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
                    Restore{" "}<span className="c-visually-hidden">{item.name}</span>
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
              <FundFigures fund={fund} />
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
              {othersPledge && pledgerMember && (
                <p className="c-form-help">
                  {pledger} will be told that you cancelled it.
                </p>
              )}
              <Feedback error={error} />
              <div className="a-field-row">
                <Button
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => updatePledge(commitment.id, {
                        cancel: true,
                        expectedAmountMinor: base?.amountMinor,
                        expectedDueOn: base?.dueOn,
                      }),
                      "Pledge cancelled.",
                      { rebaseOnConflict: true },
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
              <fieldset className="c-form-fields" disabled={pending || uncertain}>
                {mode.kind === "pledge" && othersPledge && (
                  <p className="c-form-help">
                    You can lower this pledge or move its due date later. Only{" "}
                    {pledger} can raise it or bring the date forward.
                    {pledgerMember ? " They will be told what you changed." : ""}
                  </p>
                )}
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
                    hint={mode.kind === "pledge" ? pledgeAmountHint : undefined}
                  >
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="decimal"
                      maxLength={LIMITS.money}
                      required={mode.kind !== "create" && mode.kind !== "edit"}
                    />
                  </Field>
                )}
                {mode.kind === "pledge" && (
                  <Field
                    label="Due date"
                    hint={othersPledge && commitment ? `${formatReminderDay(commitment.dueOn)} or later.` : undefined}
                  >
                    <input
                      type="date"
                      value={date}
                      min={othersPledge && commitment ? commitment.dueOn : undefined}
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
      <ReminderFlowDialog flow={chase} usage={reminderUsage} />
    </>
  );
}
