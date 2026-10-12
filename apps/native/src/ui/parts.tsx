import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown } from "lucide-react-native";
import { standing, type Need, type Waiting } from "../lib/derive";
import { firstName, joinAnd, money } from "../lib/format";
import { failure, useApp } from "../state";
import type { Snapshot } from "../lib/types";
import { photoOf } from "./chrome";
import { Button, Cal, Faces, Group, Meta, Row, State, T, Who, tap } from "./kit";
import { useToast } from "./toast";
import { useTheme } from "./theme";

/** "Mark done" for a task that is your turn, with a confirmation. */
export function useCompleteTask() {
  const { completeTask } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(need: Extract<Need, { kind: "task" }>) {
    setBusy(need.key);
    try {
      await completeTask(need.communeId, need.operationId, need.date);
      tap("success");
      toast(`${need.title} is done. Everyone in the commune can see it.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t mark it done. Try again."));
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

export function NeedRow({ need, first }: { need: Need; first?: boolean }) {
  const router = useRouter();
  const { today } = useApp();
  const task = useCompleteTask();
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
      ? <Button size="sm" variant="secondary" label="I’ve paid" accessibilityLabel={`I’ve paid ${need.payerName} for ${need.title}`} onPress={() => router.push(`/record/${need.shareId}`)} />
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
  const { nudge } = useApp();
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
  return <Row first={first} onPress={() => router.push(`/expense/${entry.expenseId}`)}
    left={<Faces names={entry.debtors.map((debtor) => debtor.name)} size={28} />}
    title={entry.title}
    meta={<>
      <Meta>{money(total, entry.currency)}</Meta>
      {toConfirm.length
        ? <State text={`${joinAnd(toConfirm.map((debtor) => firstName(debtor.name)))} says they’ve paid`} tone="attention" />
        : <State text={entry.status.text} tone={entry.status.tone} />}
    </>}
    right={toConfirm.length
      ? <Button size="sm" label="Review" onPress={() => router.push("/settle")} />
      : nudgeable.length ? <Button size="sm" variant="secondary" label="Nudge" busy={busy} onPress={() => void send()} />
      : nudged ? <T kind="note" muted>Nudged today</T> : null}
  />;
}

export function CommuneTiles() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, needs, waiting, recorded, setCurrent } = useApp();
  const rows: Snapshot[][] = [];
  snapshots.forEach((snapshot, index) => { if (index % 3 === 0) rows.push([]); rows[rows.length - 1].push(snapshot); });
  return <View style={{ gap: 16 }}>
    {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 10 }}>
      {row.map((snapshot) => <Tile key={snapshot.commune.id} snapshot={snapshot}
        info={standing(snapshot, needs, waiting, recorded)}
        onPress={() => { setCurrent(snapshot.commune.id); router.push("/hub"); }} c={c.ink2} placeholder={c.recessed} />)}
      {Array.from({ length: 3 - row.length }, (_, spare) => <View key={`spare-${spare}`} style={{ flex: 1 }} />)}
    </View>)}
  </View>;
}
function Tile({ snapshot, info, onPress, c, placeholder }: { snapshot: Snapshot; info: ReturnType<typeof standing>; onPress: () => void; c: string; placeholder: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${snapshot.commune.name}. ${info.line}.`} onPress={onPress}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 8, opacity: pressed ? 0.85 : 1 })}>
    <Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: "100%", aspectRatio: 1 / 0.9, borderRadius: 12, backgroundColor: placeholder }} />
    <View>
      <T kind="label" style={{ fontWeight: "600", lineHeight: 17 }} lines={2}>{snapshot.commune.name}</T>
      <T kind="note" color={c} style={{ marginTop: 1 }}>{info.line}</T>
      {info.state ? <View style={{ marginTop: 3 }}><State text={info.state.text} tone={info.state.tone} /></View> : null}
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
          <Button size="lg" block label={`I’ve paid ${firstName(need.payerName)} ${money(need.amountMinor, need.currency)}`} onPress={() => router.push(`/record/${need.shareId}`)} />
          <T kind="note" muted>Pay {firstName(need.payerName)} however you usually do, then record it here. {firstName(need.payerName)} confirms it.</T>
        </>
        : <Button size="lg" block label="Mark done" busy={task.busy === need.key} onPress={() => void task.run(need)} />}
    </View>
  </View>;
}
