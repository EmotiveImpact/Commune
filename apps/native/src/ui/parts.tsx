import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown } from "lucide-react-native";
import { standing, tilePulse, type Need, type Waiting } from "../lib/derive";
import { firstName, joinAnd, money } from "../lib/format";
import { failure, useApp } from "../state";
import type { Snapshot } from "../lib/types";
import { photoOf } from "./chrome";
import { Avatar, Button, Cal, Faces, Group, Meta, Row, State, T, Who, tap } from "./kit";
import { PayPrimary, usePayable } from "./pay";
import { useToast } from "./toast";
import { useTheme } from "./theme";

/** "Mark done" for a task, with a confirmation that offers Undo for a few seconds. */
export function useCompleteTask() {
  const { completeTask, undoCompletion } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function complete(key: string, communeId: string, operationId: string, date: string, title: string, doneBy?: "me" | "assignee") {
    setBusy(key);
    try {
      const occurrenceId = await completeTask(communeId, operationId, date, doneBy);
      tap("success");
      toast(`${title} is done.`, occurrenceId ? {
        label: "Undo",
        onPress: () => void undoCompletion(communeId, occurrenceId)
          .then(() => toast(`${title} is open again.`))
          .catch((cause) => toast(failure(cause, "Couldn’t undo that. Try again."))),
      } : undefined);
    } catch (cause) {
      toast(failure(cause, "Couldn’t mark it done. Try again."));
    } finally {
      setBusy(null);
    }
  }
  return {
    busy,
    run: (need: Extract<Need, { kind: "task" }>) => complete(need.key, need.communeId, need.operationId, need.date, need.title),
    complete,
  };
}

export function NeedRow({ need, first }: { need: Need; first?: boolean }) {
  const router = useRouter();
  const { today } = useApp();
  const task = useCompleteTask();
  const payable = usePayable(need.communeId, need.kind === "share" ? need.payerId : "");
  return <Row first={first}
    accessibilityLabel={`${need.title}. ${need.status.text}.`}
    onPress={() => router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks")}
    left={<Cal iso={need.dueOn} today={today} small />}
    title={need.title}
    meta={<>
      <Meta>{need.kind === "task" ? "Your turn" : `Your share ${money(need.amountMinor, need.currency)}`}</Meta>
      <State text={need.status.text} tone={need.status.tone} />
    </>}
    right={need.kind === "share"
      ? payable
        ? <Button size="sm" variant="secondary" label="Pay" accessibilityLabel={`Pay ${need.payerName} for ${need.title}`} onPress={() => router.push(`/pay/${need.shareId}`)} />
        : <Button size="sm" variant="secondary" label="I’ve paid" accessibilityLabel={`I’ve paid ${need.payerName} for ${need.title}`} onPress={() => router.push(`/record/${need.shareId}`)} />
      : <Button size="sm" variant="secondary" label="Mark done" busy={task.busy === need.key} onPress={() => void task.run(need)} />}
  />;
}

/** Needs grouped by when they are due, with "Show more" after the first few. */
export function NeedsList({ items, initial = Infinity }: { items: Need[]; initial?: number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  const rows: React.ReactNode[] = [];
  let band = "";
  shown.forEach((need, index) => {
    const starts = need.band !== band;
    if (starts) {
      band = need.band;
      rows.push(<Group key={`band-${band}`} first={index === 0} label={band} late={band === "Overdue"} count={items.filter((item) => item.band === need.band).length} />);
    }
    rows.push(<NeedRow key={need.key} need={need} first={starts} />);
  });
  return <>
    {rows}
    {items.length > initial
      ? <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.outline }}>
        <T kind="label" style={{ fontWeight: "500" }}>{open ? "Show less" : `Show ${items.length - initial} more`}</T>
        <ChevronDown size={15} color={c.ink} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </Pressable>
      : null}
  </>;
}

export function WaitingRow({ entry, first }: { entry: Waiting; first?: boolean }) {
  const router = useRouter();
  const { nudge, resolveReport } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const total = entry.debtors.reduce((sum, debtor) => sum + debtor.amountMinor, 0);
  const toConfirm = entry.debtors.filter((debtor) => debtor.pending);
  const nudgeable = entry.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending);
  const nudged = entry.debtors.some((debtor) => debtor.nudgedToday);
  async function send() {
    setBusy(true);
    try {
      for (const debtor of nudgeable) await nudge(entry.communeId, debtor.shareId);
      toast(`Nudged ${joinAnd(nudgeable.map((debtor) => firstName(debtor.name)))}.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send the nudge."));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    const debtor = toConfirm[0];
    if (!debtor?.pending) return;
    setBusy(true);
    try {
      await resolveReport(entry.communeId, debtor.pending.id, "confirm");
      tap("success");
      toast(`Confirmed. ${firstName(debtor.name)}’s ${money(debtor.pending.amountMinor, entry.currency)} is recorded.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t confirm it. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return <Row first={first} onPress={() => router.push(`/expense/${entry.expenseId}`)}
    left={<Faces names={entry.debtors.map((debtor) => debtor.name)} size={28} />}
    title={entry.title}
    meta={<>
      <Meta>{money(total, entry.currency)}</Meta>
      {toConfirm.length
        ? <State text={`${joinAnd(toConfirm.map((debtor) => firstName(debtor.name)))} says they’ve paid`} tone="attention" />
        : <State text={entry.status.text} tone={entry.status.tone} />}
    </>}
    right={toConfirm.length === 1 && toConfirm[0].pending
      ? <Button size="sm" label={`Confirm ${money(toConfirm[0].pending.amountMinor, entry.currency)}`} busy={busy}
        accessibilityLabel={`Confirm ${firstName(toConfirm[0].name)} paid ${money(toConfirm[0].pending.amountMinor, entry.currency)} for ${entry.title}`} onPress={() => void confirm()} />
      : toConfirm.length ? <Button size="sm" label="Review" onPress={() => router.push("/settle")} />
      : nudgeable.length ? <Button size="sm" variant="secondary" label="Nudge" busy={busy} onPress={() => void send()} />
      : nudged ? <T kind="note" muted>Nudged today</T> : null}
  />;
}

export function CommuneTiles() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, needs, waiting, recorded, setCurrent, user, today } = useApp();
  const rows: Snapshot[][] = [];
  snapshots.forEach((snapshot, index) => { if (index % 3 === 0) rows.push([]); rows[rows.length - 1].push(snapshot); });
  return <View style={{ gap: 16 }}>
    {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 10 }}>
      {row.map((snapshot) => <Tile key={snapshot.commune.id} snapshot={snapshot}
        info={standing(snapshot, needs, waiting, recorded)} pulse={tilePulse(snapshot, user?.id ?? "", today)}
        onPress={() => { setCurrent(snapshot.commune.id); router.push("/hub"); }} c={c.ink2} placeholder={c.recessed} />)}
      {Array.from({ length: 3 - row.length }, (_, spare) => <View key={`spare-${spare}`} style={{ flex: 1 }} />)}
    </View>)}
  </View>;
}
function Tile({ snapshot, info, pulse, onPress, c, placeholder }: {
  snapshot: Snapshot; info: ReturnType<typeof standing>; pulse: ReturnType<typeof tilePulse>; onPress: () => void; c: string; placeholder: string;
}) {
  const { c: palette } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${snapshot.commune.name}. ${info.line}. ${pulse.text}.`} onPress={onPress}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 8, opacity: pressed ? 0.85 : 1 })}>
    <Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: "100%", aspectRatio: 1 / 0.9, borderRadius: 12, backgroundColor: placeholder }} />
    <View>
      <T kind="label" style={{ fontWeight: "600", lineHeight: 17 }} lines={2}>{snapshot.commune.name}</T>
      <T kind="note" color={c} style={{ marginTop: 1 }}>{info.line}</T>
      {info.state && info.state.tone !== "late" ? <View style={{ marginTop: 3 }}><State text={info.state.text} tone={info.state.tone} /></View> : null}
      <T kind="note" color={pulse.late ? palette.late : palette.action} style={{ marginTop: 3, fontWeight: "500" }}>{pulse.text}</T>
    </View>
  </Pressable>;
}

/** The first thing to do, raised over the dark band on Home. */
export function NextStep({ need, total }: { need: Need | undefined; total: number }) {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshotOf, waiting, today } = useApp();
  const task = useCompleteTask();
  const card = { backgroundColor: c.surface, borderRadius: 15, padding: 18, paddingBottom: 20, gap: 16, shadowColor: "#121622", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 };
  if (!need) {
    const late = waiting.find((entry) => entry.status.tone === "attention");
    return <View style={card} accessibilityLabel="Your next step">
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.settled, alignItems: "center", justifyContent: "center" }}><Check size={22} color={c.onSettled} /></View>
        <View style={{ flex: 1 }}>
          <T kind="strong" style={{ fontSize: 17 }}>Nothing needs you</T>
          <T kind="label" muted>{late ? `${late.title} is ${late.status.text}. ${joinAnd(late.debtors.map((debtor) => firstName(debtor.name)))} can see it.` : "Everyone is up to date."}</T>
        </View>
      </View>
    </View>;
  }
  const commune = snapshotOf(need.communeId)?.commune;
  return <View style={card} accessibilityLabel="Your next step">
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <T kind="note" muted style={{ fontWeight: "500" }}>Your next step</T>
      <T kind="note" muted style={{ fontWeight: "500" }}>1 of {total}</T>
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks")} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      {need.kind === "share" && commune ? <Who name={need.payerName} photo={photoOf(commune.kind)} /> : <Cal iso={need.dueOn} today={today} small />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="strong" style={{ fontSize: 17, lineHeight: 23 }}>{need.title}</T>
        <T kind="label" muted>{commune?.name} · {need.kind === "task" ? "your turn" : "your share"}</T>
        <View style={{ marginTop: 6 }}><State text={need.status.text} tone={need.status.tone} /></View>
      </View>
      {need.kind === "share" ? <T kind="amount" style={{ fontSize: 22, lineHeight: 26 }}>{money(need.amountMinor, need.currency)}</T> : null}
    </Pressable>
    <View style={{ gap: 10 }}>
      {need.kind === "share"
        ? <>
          <PayPrimary target={{ shareId: need.shareId, communeId: need.communeId, payerId: need.payerId, payerName: need.payerName, amountMinor: need.amountMinor, currency: need.currency, title: need.title }} />
        </>
        : <Button size="lg" block label="Mark done" busy={task.busy === need.key} onPress={() => void task.run(need)} />}
    </View>
  </View>;
}

/**
 * A task you can tick off. Your own or an unclaimed one completes straight
 * away; someone else's asks first whether you did it or they did.
 */
export function TaskCheck({ communeId, operationId, date, title, assigneeId, assigneeName, meta, late, first }: {
  communeId: string; operationId: string; date: string; title: string; assigneeId: string | null; assigneeName: string;
  meta: string; late?: boolean; first?: boolean;
}) {
  const { c } = useTheme();
  const { user } = useApp();
  const task = useCompleteTask();
  const [asking, setAsking] = useState(false);
  const key = `task:${operationId}`;
  const mine = assigneeId === user?.id;
  const theirs = !!assigneeId && !mine;
  const done = (doneBy?: "me" | "assignee") => { setAsking(false); void task.complete(key, communeId, operationId, date, title, doneBy ?? (assigneeId ? undefined : "me")); };
  return <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: c.outline2, backgroundColor: late ? c.lateSoft : "transparent" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 6 }}>
      <Avatar name={assigneeId ? assigneeName : "?"} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{title}</T>
        <T kind="label" color={late ? c.late : c.ink2}>{meta}</T>
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false, busy: task.busy === key }} accessibilityLabel={`Mark ${title} done`}
        disabled={task.busy === key} onPress={() => (theirs ? setAsking(!asking) : done())}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: task.busy === key ? c.action : c.ink2, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
          {task.busy === key ? <Check size={15} color={c.action} /> : null}
        </View>
      </Pressable>
    </View>
    {asking ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
      <T kind="label" muted style={{ width: "100%" }}>Who did it?</T>
      <Button size="sm" variant="secondary" label="I did it" onPress={() => done("me")} />
      <Button size="sm" variant="secondary" label={`${firstName(assigneeName)} did it`} onPress={() => done("assignee")} />
    </View> : null}
  </View>;
}
