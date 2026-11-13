import { SwipeRow } from "./swipe";
import { HOLD, useRemind } from "./remind";
import { useEffect, useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Check, ChevronDown, Clock3 } from "lucide-react-native";
import { standing, tilePulse, type Need, type Waiting } from "../lib/derive";
import { firstName, joinAnd, money } from "../lib/format";
import { failure, useApp } from "../state";
import type { Snapshot } from "../lib/types";
import { photoOf } from "./chrome";
import type { Rect as Box } from "./origin";
import { Avatar, Button, Cal, FadeImage, Faces, Group, Meta, Row, State, T, TextLink, Who, tap } from "./kit";
import { PayPrimary, usePayable } from "./pay";
import { Arrive, InPlaceCard, Sent, TickRing, useDeferred, useInPlace, withLanded } from "./settled";
import type { Settled } from "../lib/settled";
import { Rolling, Swap } from "./rolling";
import { useToast } from "./toast";
import { useTheme } from "./theme";
import Animated, { Easing, FadeIn, FadeOut, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";

const AnimatedPath = Animated.createAnimatedComponent(Path);
import { haptic, PressScale, springs, useCalm } from "./motion";

/** "Mark done" for a task, with a confirmation that offers Undo for a few seconds. */
export function useCompleteTask() {
  const { completeTask, undoCompletion } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  // quiet: the place you pressed already shows it is done (with its own Undo), so no pop-up.
  async function complete(key: string, communeId: string, operationId: string, date: string, title: string, doneBy?: "me" | "assignee", quiet?: boolean): Promise<boolean> {
    setBusy(key);
    try {
      const occurrenceId = await completeTask(communeId, operationId, date, doneBy);
      if (quiet) return true;
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
    run: (need: Extract<Need, { kind: "task" }>, quiet?: boolean) => complete(need.key, need.communeId, need.operationId, need.date, need.title, undefined, quiet),
    complete,
  };
}

/** "I'll do it": take a chore nobody has yet. */
export function useClaimTask() {
  const { claimTask } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function claim(communeId: string, operationId: string, date: string, title: string) {
    setBusy(operationId);
    try {
      await claimTask(communeId, operationId, date);
      tap("success");
      toast(`${title} is yours.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t take it. Try again."));
    } finally { setBusy(null); }
  }
  return { busy, claim };
}

export function NeedRow({ need, first, onClaim, onDone }: { need: Need; first?: boolean; onClaim?(id: string): void; onDone?(need: Extract<Need, { kind: "task" }>): void }) {
  const router = useRouter();
  const { today } = useApp();
  const task = useCompleteTask();
  const payable = usePayable(need.communeId, need.kind === "share" ? need.payerId : "");
  const remind = useRemind()(need.key);
  // v7: swipe left for "Remind me", or hold the row, and the drawer offers the options.
  return <Arrive communeId={need.communeId} title={need.title}><SwipeRow label={need.title} onRemind={remind}>{(guard) => <Row first={first} onLongPress={guard(remind)}
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
        ? <Button size="sm" variant="secondary" label="Pay" accessibilityLabel={`Pay ${need.payerName} for ${need.title}`} onPress={() => { onClaim?.(need.shareId); router.push(`/pay/${need.shareId}`); }} />
        : <Button size="sm" variant="secondary" label="I’ve paid" accessibilityLabel={`I’ve paid ${need.payerName} for ${need.title}`} onPress={() => { onClaim?.(need.shareId); router.push(`/record/${need.shareId}`); }} />
      : <Button size="sm" variant="secondary" label="Mark done" busy={task.busy === need.key} onPress={() => (onDone ? onDone(need) : void task.run(need))} />}
  />}</SwipeRow></Arrive>;
}

/** Needs grouped by when they are due, with "Show more" after the first few. */
export function NeedsList({ items, initial = Infinity }: { items: Need[]; initial?: number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  const { done, claim, show, clear } = useInPlace(3400);
  const task = useCompleteTask();
  const later = useDeferred(2800);
  // Mark done: the row says Done where it was, with Undo, and saves when that is up.
  const markDone = (need: Extract<Need, { kind: "task" }>, slot: number) => {
    haptic.light();
    const event: Settled = { id: need.key, title: "Done.", body: `${need.title} is done.`, replaces: need.key };
    later.start(() => { show(event, slot); void task.run(need, true).then((ok) => { if (!ok) clear(); }); });
    show({ ...event, action: { label: "Undo", run: () => { later.undo(); clear(); } } }, slot);
  };
  const rows: React.ReactNode[] = [];
  let band = "";
  shown.forEach((need, index) => {
    const starts = need.band !== band;
    if (starts) {
      band = need.band;
      rows.push(<Group key={`band-${band}`} first={index === 0} label={band} late={band === "Overdue"} count={items.filter((item) => item.band === need.band).length} />);
    }
    const slot = rows.length;
    rows.push(<NeedRow key={need.key} need={need} first={starts} onClaim={(id) => claim(id, slot)} onDone={(task) => markDone(task, slot)} />);
  });
  return <>
    {withLanded(rows, done)}
    {items.length > initial
      ? <PressScale scaleTo={0.985} accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.outline }}>
        <T kind="label" style={{ fontWeight: "500" }}>{open ? "Show less" : `Show ${items.length - initial} more`}</T>
        <ChevronDown size={15} color={c.ink} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </PressScale>
      : null}
  </>;
}

export function WaitingRow({ entry, first, onClaim }: { entry: Waiting; first?: boolean; onClaim?(id: string): void }) {
  const router = useRouter();
  const total = entry.debtors.reduce((sum, debtor) => sum + debtor.amountMinor, 0);
  const toConfirm = entry.debtors.filter((debtor) => debtor.pending);
  const nudgeable = entry.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending);
  const nudged = entry.debtors.some((debtor) => debtor.nudgedToday);
  const remind = useRemind()(`expense:${entry.expenseId}`);
  // Confirming and nudging open their sheets, which show the details first.
  // Swipe left or hold the row to be reminded to chase it.
  return <Arrive communeId={entry.communeId} title={entry.title}><SwipeRow label={entry.title} onRemind={remind}>{(guard) => <Row first={first} onPress={guard(() => router.push(`/expense/${entry.expenseId}`))} onLongPress={guard(remind)}
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
        accessibilityLabel={`Confirm ${firstName(toConfirm[0].name)} paid ${money(toConfirm[0].pending.amountMinor, entry.currency)} for ${entry.title}`} onPress={() => { onClaim?.(toConfirm[0].pending!.id); router.push(`/confirm/${toConfirm[0].pending!.id}`); }} />
      : toConfirm.length ? <Button size="sm" label="Review" onPress={() => router.push("/settle")} />
      : nudgeable.length ? <Button size="sm" variant="secondary" label="Nudge" onPress={() => { onClaim?.(`nudge:${entry.expenseId}`); router.push(`/nudge/${entry.expenseId}`); }} />
      : nudged ? <T kind="note" muted>Nudged today</T> : null}
  />}</SwipeRow></Arrive>;
}

/** Waiting rows; a payment confirmed from one shows All square where it was. */
export function WaitingList({ items }: { items: Waiting[] }) {
  const { done, claim } = useInPlace();
  return <>{withLanded(items.map((entry, index) => <WaitingRow key={entry.key} entry={entry} first={index === 0 && !(done && done.slot === 0)}
    onClaim={(id) => claim(id, index)} />), done)}</>;
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
  // The moment the last debt here clears, the photo dims a little and the settled ring draws on over it.
  // "All recorded" counts: your side is clear, it only waits for them to confirm.
  const square = info.line === "All square" || info.line === "All recorded";
  const was = useRef(square);
  const [moment, setMoment] = useState(false);
  useEffect(() => {
    const cleared = square && !was.current;
    was.current = square;
    if (!cleared) return;
    setMoment(true);
    const timer = setTimeout(() => setMoment(false), 2800);
    return () => clearTimeout(timer);
  }, [square]);
  const open = () => {
    const node = photo.current as unknown as { getBoundingClientRect?: () => DOMRect; measureInWindow?: View["measureInWindow"] } | null;
    if (node?.getBoundingClientRect) { const r = node.getBoundingClientRect(); onPress({ x: r.left, y: r.top, w: r.width, h: r.height }); return; }
    if (!node?.measureInWindow) { onPress(null); return; }
    node.measureInWindow((x, y, w, h) => onPress(w && h ? { x, y, w, h } : null));
  };
  return <PressScale accessibilityRole="button" accessibilityLabel={`${snapshot.commune.name}. ${info.line}. ${pulse.text}.`} onPress={open}
    style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 8, opacity: pressed ? 0.85 : 1 })}>
    <View ref={photo} collapsable={false}>
      <FadeImage uri={photoOf(snapshot.commune.kind)} placeholder={placeholder} style={{ width: "100%", aspectRatio: 1 / 0.9, borderRadius: 12 }} />
      {moment ? <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(320)} pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: "rgba(14,16,24,0.32)", alignItems: "center", justifyContent: "center" }}>
        <TickRing size={44} delay={380} />
      </Animated.View> : null}
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
  const [sent, setSent] = useState("");
  const targets = waiting.flatMap((entry) => entry.debtors.filter((debtor) => debtor.canNudge && !debtor.nudgedToday && !debtor.pending).map((debtor) => ({ communeId: entry.communeId, debtor })));
  const names = [...new Set(targets.map((item) => firstName(item.debtor.name)))];
  // Once sent, the button's place says so for a moment, then the card is calm again.
  if (sent) return <Sent text={`Sent to ${sent}`} />;
  if (!names.length) return null;
  async function send() {
    setBusy(true);
    try {
      for (const item of targets) await nudge(item.communeId, item.debtor.shareId);
      haptic.light();
      setSent(joinAnd(names));
      setTimeout(() => setSent(""), 2600);
    } catch (cause) {
      toast(failure(cause, "Couldn’t send the nudge."));
    } finally {
      setBusy(false);
    }
  }
  return <Button size="lg" block variant="secondary" label={`Nudge ${joinAnd(names)}`} busy={busy} onPress={() => void send()} />;
}

const GLIDE = Easing.bezier(0.32, 0.72, 0, 1);

/** Small dots under the next step card: one per step, the current one filled. Capped so a long list stays tidy. */
function StepDots({ count, at }: { count: number; at: number }) {
  const { c } = useTheme();
  const shown = Math.min(count, 7);
  // With more than seven steps the window of dots follows the current one.
  const start = Math.max(0, Math.min(at - 3, count - shown));
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -4, marginBottom: -6 }}>
    {Array.from({ length: shown }, (_, i) => {
      const on = start + i === at;
      return <View key={i} style={{ width: on ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: on ? c.ink : c.outline }} />;
    })}
  </View>;
}

export function NextStep({ needs }: { needs: Need[] }) {
  const total = needs.length;
  const [at, setAt] = useState(0);
  const index = Math.min(at, Math.max(0, total - 1));
  const need: Need | undefined = needs[index];
  const calm = useCalm();
  const { width } = useWindowDimensions();
  // Swipe sideways between steps, like a stack of cards. Swiping only moves
  // between steps: paying, confirming and Mark done stay on the buttons.
  const x = useSharedValue(0);
  const fade = useSharedValue(1);
  const dragged = useRef(0);
  const moved = () => { dragged.current = Date.now(); };
  const allow = () => Date.now() - dragged.current > 400;
  const go = (next: number, dir: number) => {
    setAt(next);
    haptic.select();
    if (calm) { x.value = 0; fade.value = 0; fade.value = withTiming(1, { duration: 160 }); return; }
    x.value = dir * 56;
    fade.value = 0;
    x.value = withTiming(0, { duration: 320, easing: GLIDE });
    fade.value = withTiming(1, { duration: 240, easing: GLIDE });
  };
  const many = total > 1;
  const pan = Gesture.Pan()
    .enabled(many)
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onStart(() => { runOnJS(moved)(); })
    .onUpdate((event) => {
      const t = event.translationX;
      // Past the first or last step the card follows the finger only a little.
      const edge = (t > 0 && index === 0) || (t < 0 && index === total - 1);
      x.value = edge ? t * 0.25 : t;
    })
    .onEnd((event) => {
      runOnJS(moved)();
      const t = event.translationX;
      const dir = t < 0 ? -1 : 1;
      const next = index - dir;
      const far = Math.abs(t) > 80 || Math.abs(event.velocityX) > 700;
      if (far && next >= 0 && next < total && Math.sign(event.velocityX || t) === dir) {
        if (calm) { runOnJS(go)(next, dir); return; }
        fade.value = withTiming(0, { duration: 180, easing: GLIDE });
        x.value = withTiming(dir * width, { duration: 200, easing: GLIDE }, (finished) => {
          if (finished) runOnJS(go)(next, -dir);
        });
        return;
      }
      x.value = withTiming(0, { duration: 260, easing: GLIDE });
    });
  const slide = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: x.value }, { rotate: `${Math.max(-3, Math.min(3, x.value / 60))}deg` }],
  }));
  const { c } = useTheme();
  const router = useRouter();
  const { snapshotOf, waiting, today } = useApp();
  const task = useCompleteTask();
  const remindFor = useRemind();
  const remind = need ? remindFor(need.key) : undefined;
  const card = { backgroundColor: c.surface, borderRadius: 15, padding: 18, paddingBottom: 20, gap: 16, shadowColor: "#121622", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 };
  // Paid from this card: the card itself says All square, as in the opening flow, then moves on.
  const { done, claim, show, clear } = useInPlace(3400);
  const later = useDeferred(2800);
  // Mark done: the card ticks and says Done in place, with Undo for a moment, then saves.
  const markDone = (item: Extract<Need, { kind: "task" }>) => {
    haptic.light();
    const event: Settled = { id: item.key, title: "Done.", body: `${item.title} is done.` };
    later.start(() => { show(event); void task.run(item, true).then((ok) => { if (!ok) clear(); }); });
    show({ ...event, action: { label: "Undo", run: () => { later.undo(); clear(); } } });
  };
  if (done) return <View style={card} accessibilityLabel="Your next step"><InPlaceCard done={done} /></View>;
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
  // Hold the card (or tap the clock) for Remind me tonight or tomorrow, as in v7.
  return <GestureDetector gesture={pan}><Animated.View style={[card, slide]} accessibilityLabel="Your next step"
    accessibilityHint={many ? "Swipe left or right for your other steps" : undefined}
    accessibilityActions={many ? [{ name: "increment", label: "Next step" }, { name: "decrement", label: "Previous step" }] : undefined}
    onAccessibilityAction={(event) => {
      const next = index + (event.nativeEvent.actionName === "increment" ? 1 : -1);
      if (next >= 0 && next < total) go(next, next > index ? 1 : -1);
    }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: -6 }}>
      <T kind="note" muted style={{ fontWeight: "500" }}>Your next step</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <T kind="note" muted style={{ fontWeight: "500" }}>{index + 1} of {total}</T>
        <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel={`Remind me about ${need.title}`} onPress={remind}
          hitSlop={6} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: -8 }}>
          <Clock3 size={16} color={c.ink2} />
        </PressScale>
      </View>
    </View>
    <PressScale scaleTo={0.985} accessibilityRole="button" accessibilityHint="Hold for a reminder" onLongPress={() => { if (allow()) remind?.(); }} delayLongPress={HOLD}
      onPress={() => allow() && router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks")} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
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
          <PayPrimary allow={allow} onStart={() => claim(need.shareId)} target={{ shareId: need.shareId, communeId: need.communeId, payerId: need.payerId, payerName: need.payerName, amountMinor: need.amountMinor, currency: need.currency, title: need.title }} />
        </>
        : <Button size="lg" block label="Mark done" busy={task.busy === need.key} onPress={() => { if (allow()) markDone(need); }} />}
    </View>
    {many ? <StepDots count={total} at={index} /> : null}
  </Animated.View></GestureDetector>;
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
  const claimer = useClaimTask();
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
  // The tick draws on and the row says Done with Undo for a moment, then
  // closes up and saves. Undo before then simply never saves it.
  const later = useDeferred(2800);
  const [undoable, setUndoable] = useState(false);
  const reopen = () => {
    setTicked(false); setUndoable(false);
    shut.value = withTiming(0, { duration: 200 });
    fillBox.value = withTiming(0, { duration: 150 });
    drawn.value = withTiming(0, { duration: 150 });
  };
  const done = (doneBy?: "me" | "assignee") => {
    setAsking(false); setTicked(true); setUndoable(true);
    haptic.light();
    fillBox.value = withTiming(1, { duration: calm ? 120 : 200 });
    drawn.value = calm ? 1 : withDelay(50, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }));
    const save = () => task.complete(key, communeId, operationId, date, title, doneBy ?? (assigneeId ? undefined : "me"), true);
    later.start(() => {
      setUndoable(false);
      if (!calm) shut.value = withSpring(1, { ...springs.snappy, overshootClamping: true });
      // Save once the row has closed, so the list reloading does not cut the motion short.
      void (calm ? save() : new Promise<boolean>((resolve) => setTimeout(() => resolve(save()), 320))).then((ok) => { if (!ok) reopen(); });
    });
  };
  const undo = () => { later.undo(); reopen(); };
  const on = ticked || task.busy === key;
  const remind = useRemind()(key);
  return <Animated.View exiting={calm ? FadeOut.duration(150) : undefined}
    onLayout={(event) => { if (!ticked) rowH.value = event.nativeEvent.layout.height; }}
    style={[{ borderTopWidth: first ? 0 : 1, borderTopColor: c.outline2, backgroundColor: late ? c.lateSoft : "transparent" }, rowStyle]}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 6 }}>
      {/* Hold the chore for a reminder. */}
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} accessibilityHint="Hold for a reminder" onLongPress={remind} delayLongPress={HOLD}
        style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={assigneeId ? assigneeName : "?"} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{title}</T>
          {undoable
            ? <Animated.View entering={FadeIn.duration(180)} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 20 }}>
              <T kind="label" color={c.action} style={{ fontWeight: "600" }}>Done</T>
              <TextLink muted label="Undo" accessibilityLabel={`Undo ${title}`} onPress={undo} />
            </Animated.View>
            : <T kind="label" color={late ? c.late : c.ink2}>{meta}</T>}
        </View>
      </Pressable>
      {!assigneeId && !on ? <Button size="sm" variant="secondary" label="I’ll do it" busy={claimer.busy === operationId}
        onPress={() => void claimer.claim(communeId, operationId, date, title)} /> : null}
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
