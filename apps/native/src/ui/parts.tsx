import { SwipeRow } from "./swipe";
import { useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";
import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown } from "lucide-react-native";
import { standing, tilePulse, type Need, type Waiting } from "../lib/derive";
import { firstName, joinAnd, money } from "../lib/format";
import { failure, useApp } from "../state";
import type { Snapshot } from "../lib/types";
import { photoOf } from "./chrome";
import type { Rect as Box } from "./origin";
import { Avatar, Button, Cal, Faces, Group, Meta, Row, State, T, Who, tap } from "./kit";
import { PayPrimary, usePayable } from "./pay";
import { Rolling, Swap } from "./rolling";
import { useToast } from "./toast";
import { useTheme } from "./theme";
import Animated, { Easing, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);
import { PressScale, springs, useCalm } from "./motion";

/** "Mark done" for a task, with a confirmation that offers Undo for a few seconds. */
export function useCompleteTask() {
  const { completeTask, undoCompletion } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function complete(key: string, communeId: string, operationId: string, date: string, title: string, doneBy?: "me" | "assignee"): Promise<boolean> {
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
      return true;
    } catch (cause) {
      toast(failure(cause, "Couldn’t mark it done. Try again."));
      return false;
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
  const remind = () => { tap("light"); router.push(`/remind/${encodeURIComponent(need.key)}`); };
  // v7: swipe left for "Remind me", or hold the row, and the drawer offers the options.
  return <SwipeRow label={need.title} onRemind={remind}>{(guard) => <Row first={first} onLongPress={guard(remind)}
    accessibilityLabel={`${need.title}. ${need.status.text}.`}
    onPress={guard(() => router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks"))}
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
  />}</SwipeRow>;
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
      ? <PressScale scaleTo={0.985} accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.outline }}>
        <T kind="label" style={{ fontWeight: "500" }}>{open ? "Show less" : `Show ${items.length - initial} more`}</T>
        <ChevronDown size={15} color={c.ink} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </PressScale>
      : null}
  </>;
}

export function WaitingRow({ entry, first }: { entry: Waiting; first?: boolean }) {
  const router = useRouter();
  const total = entry.debtors.reduce((sum, debtor) => sum + debtor.amountMinor, 0);
  const toConfirm = entry.debtors.filter((debtor) => debtor.pending);
  const nudgeable = entry.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending);
  const nudged = entry.debtors.some((debtor) => debtor.nudgedToday);
  // Confirming and nudging open their sheets, which show the details first.
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
      ? <Button size="sm" label={`Confirm ${money(toConfirm[0].pending.amountMinor, entry.currency)}`} 
        accessibilityLabel={`Confirm ${firstName(toConfirm[0].name)} paid ${money(toConfirm[0].pending.amountMinor, entry.currency)} for ${entry.title}`} onPress={() => router.push(`/confirm/${toConfirm[0].pending!.id}`)} />
      : toConfirm.length ? <Button size="sm" label="Review" onPress={() => router.push("/settle")} />
      : nudgeable.length ? <Button size="sm" variant="secondary" label="Nudge" onPress={() => router.push(`/nudge/${entry.expenseId}`)} />
      : nudged ? <T kind="note" muted>Nudged today</T> : null}
  />;
}

export function CommuneTiles() {
  const { c } = useTheme();
  const router = useRouter();
  const { snapshots, needs, waiting, recorded, setCurrent, user, today, current } = useApp();
  const rows: Snapshot[][] = [];
  snapshots.forEach((snapshot, index) => { if (index % 3 === 0) rows.push([]); rows[rows.length - 1].push(snapshot); });
  return <View style={{ gap: 16 }}>
    {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 10 }}>
      {row.map((snapshot) => <Tile key={snapshot.commune.id} snapshot={snapshot}
        info={standing(snapshot, needs, waiting, recorded)} pulse={tilePulse(snapshot, user?.id ?? "", today)}
        onPress={() => {
          // No photo flight into the Hub (Edem, 7 Nov: no morphs); the Hub simply opens.
          setCurrent(snapshot.commune.id); router.push("/hub");
        }} c={c.ink2} placeholder={c.recessed}
        isCurrent={snapshots.length > 1 && current?.commune.id === snapshot.commune.id} />)}
      {Array.from({ length: 3 - row.length }, (_, spare) => <View key={`spare-${spare}`} style={{ flex: 1 }} />)}
    </View>)}
  </View>;
}
function Tile({ snapshot, info, pulse, onPress, c, placeholder, isCurrent }: {
  snapshot: Snapshot; info: ReturnType<typeof standing>; pulse: ReturnType<typeof tilePulse>; onPress: (from: Box | null) => void; c: string; placeholder: string; isCurrent?: boolean;
}) {
  const photo = useRef<View>(null);
  const open = () => {
    const node = photo.current as unknown as { getBoundingClientRect?: () => DOMRect; measureInWindow?: View["measureInWindow"] } | null;
    if (node?.getBoundingClientRect) { const r = node.getBoundingClientRect(); onPress({ x: r.left, y: r.top, w: r.width, h: r.height }); return; }
    if (!node?.measureInWindow) { onPress(null); return; }
    node.measureInWindow((x, y, w, h) => onPress(w && h ? { x, y, w, h } : null));
  };
  return <PressScale accessibilityRole="button" accessibilityLabel={`${snapshot.commune.name}. ${info.line}. ${pulse.text}.`} onPress={open}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 8, opacity: pressed ? 0.85 : 1 })}>
    <View ref={photo} collapsable={false}>
      <Image source={{ uri: photoOf(snapshot.commune.kind) }} style={{ width: "100%", aspectRatio: 1 / 0.9, borderRadius: 12, backgroundColor: placeholder }} />
      {/* v7's "Current" tag: a small dark glass label on the photo. */}
      {isCurrent ? <View style={{ position: "absolute", left: 6, top: 6, height: 18, paddingHorizontal: 7, borderRadius: 9, backgroundColor: "rgba(14,16,24,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", justifyContent: "center" }}>
        <T kind="note" color="#fff" style={{ fontSize: 10.5, lineHeight: 14, fontWeight: "600" }}>Current</T>
      </View> : null}
    </View>
    <View style={{ gap: 3 }}>
      <T kind="label" style={{ fontWeight: "600", lineHeight: 17 }} lines={2}>{snapshot.commune.name}</T>
      <Rolling text={info.line} style={{ fontSize: 12, lineHeight: 16, color: c }} />
      <Swap value={pulse.text}><State text={pulse.text} tone={pulse.late ? "late" : "plain"} /></Swap>
    </View>
  </PressScale>;
}

/** The first thing to do, raised over the dark band on Home. */
/** With nothing to do, the calm next step offers to nudge whoever still owes you (v7). */
function CalmNudge() {
  const { waiting, nudge } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const targets = waiting.flatMap((entry) => entry.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending).map((debtor) => ({ communeId: entry.communeId, debtor })));
  const names = [...new Set(targets.map((item) => firstName(item.debtor.name)))];
  if (!names.length) return null;
  async function send() {
    setBusy(true);
    try {
      for (const item of targets) await nudge(item.communeId, item.debtor.shareId);
      toast(`Nudged ${joinAnd(names)}.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send the nudge."));
    } finally {
      setBusy(false);
    }
  }
  return <Button size="lg" block variant="secondary" label={`Nudge ${joinAnd(names)}`} busy={busy} onPress={() => void send()} />;
}

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
      <CalmNudge />
    </View>;
  }
  const commune = snapshotOf(need.communeId)?.commune;
  return <View style={card} accessibilityLabel="Your next step">
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <T kind="note" muted style={{ fontWeight: "500" }}>Your next step</T>
      <T kind="note" muted style={{ fontWeight: "500" }}>1 of {total}</T>
    </View>
    <PressScale scaleTo={0.985} accessibilityRole="button" onPress={() => router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks")} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      {need.kind === "share" && commune ? <Who name={need.payerName} photo={photoOf(commune.kind)} /> : <Cal iso={need.dueOn} today={today} small />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Swap value={need.key}><T kind="strong" style={{ fontSize: 17, lineHeight: 23 }}>{need.title}</T></Swap>
        <T kind="label" muted>{commune?.name} · {need.kind === "task" ? "your turn" : "your share"}</T>
        <View style={{ marginTop: 6 }}><State text={need.status.text} tone={need.status.tone} /></View>
      </View>
      {need.kind === "share" ? <Rolling text={money(need.amountMinor, need.currency)} style={{ fontSize: 22, lineHeight: 26, fontWeight: "600", letterSpacing: -0.15, fontVariant: ["tabular-nums"], color: c.ink }} /> : null}
    </PressScale>
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
  const calm = useCalm();
  const { user } = useApp();
  const task = useCompleteTask();
  const [asking, setAsking] = useState(false);
  const [ticked, setTicked] = useState(false);
  const key = `task:${operationId}`;
  const mine = assigneeId === user?.id;
  const theirs = !!assigneeId && !mine;
  // v7's tick: the box fills over 0.2 s, the tick draws on after 50 ms, and
  // at 300 ms the row closes up. If saving fails the row opens again.
  const fillBox = useSharedValue(0);
  const drawn = useSharedValue(0);
  const shut = useSharedValue(0);
  const rowH = useSharedValue(0);
  const boxStyle = useAnimatedStyle(() => ({ opacity: fillBox.value }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: 22 * (1 - drawn.value) }));
  const rowStyle = useAnimatedStyle(() => (shut.value === 0 || rowH.value === 0 ? {} : {
    height: rowH.value * (1 - shut.value), opacity: 1 - Math.min(1, shut.value * 1.6), overflow: "hidden",
  }));
  const done = (doneBy?: "me" | "assignee") => {
    setAsking(false); setTicked(true);
    fillBox.value = withTiming(1, { duration: calm ? 120 : 200 });
    drawn.value = calm ? 1 : withDelay(50, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }));
    if (!calm) shut.value = withDelay(300, withSpring(1, { ...springs.snappy, overshootClamping: true }));
    // Save once the row has closed, so the list reloading does not cut the motion short.
    const save = () => task.complete(key, communeId, operationId, date, title, doneBy ?? (assigneeId ? undefined : "me"));
    void (calm ? save() : new Promise<boolean>((resolve) => setTimeout(() => resolve(save()), 620))).then((ok) => {
      if (ok) return;
      setTicked(false);
      shut.value = withSpring(0, springs.snappy);
      fillBox.value = withTiming(0, { duration: 150 });
      drawn.value = withTiming(0, { duration: 150 });
    });
  };
  const on = ticked || task.busy === key;
  return <Animated.View exiting={calm ? FadeOut.duration(150) : undefined}
    onLayout={(event) => { if (!ticked) rowH.value = event.nativeEvent.layout.height; }}
    style={[{ borderTopWidth: first ? 0 : 1, borderTopColor: c.outline2, backgroundColor: late ? c.lateSoft : "transparent" }, rowStyle]}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 6 }}>
      <Avatar name={assigneeId ? assigneeName : "?"} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{title}</T>
        <T kind="label" color={late ? c.late : c.ink2}>{meta}</T>
      </View>
      <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: on, busy: task.busy === key }} accessibilityLabel={`Mark ${title} done`}
        disabled={on} onPress={() => (theirs ? setAsking(!asking) : done())} scaleTo={0.9}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: on ? c.action : c.ink2, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.action }, boxStyle]} />
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <AnimatedPath d="M5.5 12.5l4.2 4.2 8.8-9.2" stroke={c.onAction} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={22} animatedProps={tickProps} />
          </Svg>
        </View>
      </PressScale>
    </View>
    {asking ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
      <T kind="label" muted style={{ width: "100%" }}>Who did it?</T>
      <Button size="sm" variant="secondary" label="I did it" onPress={() => done("me")} />
      <Button size="sm" variant="secondary" label={`${firstName(assigneeName)} did it`} onPress={() => done("assignee")} />
    </View> : null}
  </Animated.View>;
}
