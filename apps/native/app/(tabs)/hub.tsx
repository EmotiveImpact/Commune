import { useState } from "react";
import { ImageBackground, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { CalendarDays, Check, Copy, Eye, EyeOff, Phone, Plus, ReceiptText } from "lucide-react-native";
import {
  activeMembers, essentials, hubMoneyLine, oweTotals, owedTotals, people, week, weekSentence,
  type Essential, type WeekItem,
} from "../../src/lib/derive";
import { addDays, calParts, firstName, money } from "../../src/lib/format";
import { failure, useApp } from "../../src/state";
import { Body, Pad, ScopeRow, TopBar, photoOf } from "../../src/ui/chrome";
import { Avatar, Button, Cal, Empty, Faces, Panel, SectionHead, State, T, tap } from "../../src/ui/kit";
import { TaskCheck } from "../../src/ui/parts";
import { PayPrimary } from "../../src/ui/pay";
import { useToast } from "../../src/ui/toast";
import { KIND_NAME, radius, useTheme } from "../../src/ui/theme";

/**
 * The Hub, the house at a glance: this week's pulse on the photo, your part
 * with the one payment to record next, the week day by day, the people you
 * share with, and the details everyone looks up.
 */
export default function Hub() {
  const { c } = useTheme();
  const { current, user, today } = useApp();
  if (!current) return <View style={{ flex: 1 }}><TopBar title="This Hub" /><Body><Pad><T kind="body" muted>You’re not in a commune yet.</T></Pad></Body></View>;
  const { commune } = current;
  const viewerId = user?.id ?? "";
  const members = activeMembers(current);
  const thisWeek = week(current, viewerId, today);
  const place = commune.address || commune.destination || "";
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <TopBar title="This Hub" />
    <Body>
      <Pad gap={22}>
        <ScopeRow />
        <ImageBackground source={{ uri: photoOf(commune.kind) }} imageStyle={{ borderRadius: 15 }} style={{ minHeight: 220, borderRadius: 15, overflow: "hidden", justifyContent: "flex-end", backgroundColor: c.frameRaised }}>
          <View style={{ padding: 18, gap: 4, backgroundColor: "rgba(14,16,24,0.5)" }}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>{KIND_NAME[commune.kind]}</Text>
            <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.5 }}>{commune.name}</Text>
            {place ? <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>{place}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
              <Faces names={members.map((member) => member.name)} size={28} ring="rgba(255,255,255,0.9)" />
              <Text style={{ color: "#fff", fontSize: 13 }}>{members.length} {members.length === 1 ? "person" : "people"}</Text>
            </View>
            <View style={{ alignSelf: "flex-start", marginTop: 8, backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "#1a1e2b", fontSize: 13, fontWeight: "500" }}>{weekSentence(thisWeek)}</Text>
            </View>
          </View>
        </ImageBackground>
        <YourPart />
        <WeekPanel />
        <PeoplePanel />
        <Essentials />
      </Pad>
    </Body>
  </View>;
}

/** Where you stand here, and the one payment to record next. */
function YourPart() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, needs, waiting, resolveReport } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!current) return null;
  const { commune } = current;
  const owe = oweTotals(needs, commune.id)[commune.currency] ?? 0;
  const owed = owedTotals(waiting, commune.id)[commune.currency] ?? 0;
  const shares = needs.filter((need) => need.communeId === commune.id && need.kind === "share");
  const first = shares[0]?.kind === "share" ? shares[0] : undefined;
  const confirms = waiting.filter((entry) => entry.communeId === commune.id).flatMap((entry) => entry.debtors.filter((debtor) => debtor.pending).map((debtor) => ({ entry, debtor })));
  const toConfirm = !first ? confirms[0] : undefined;
  async function confirm() {
    if (!toConfirm?.debtor.pending) return;
    setBusy(true);
    try {
      await resolveReport(commune.id, toConfirm.debtor.pending.id, "confirm");
      tap("success");
      toast(`Confirmed. ${firstName(toConfirm.debtor.name)}’s ${money(toConfirm.debtor.pending.amountMinor, commune.currency)} is recorded.`);
    } catch (cause) {
      toast(failure(cause, "Couldn’t confirm it. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return <View accessibilityLabel="Your part" style={{ backgroundColor: c.settled + "99", borderRadius: radius.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline, padding: 16, gap: 10 }}>
    <T kind="note" muted style={{ fontWeight: "600", letterSpacing: 0.7, textTransform: "uppercase" }}>Your part in {commune.name}</T>
    <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 24, lineHeight: 30, fontWeight: "500", letterSpacing: -0.4 }}>
      {owe > 0 ? <>You owe <Text style={{ color: c.ink, backgroundColor: c.surface }}> {money(owe, commune.currency)} </Text> here.</>
        : owed > 0 ? <>You’re owed <Text style={{ backgroundColor: c.surface }}> {money(owed, commune.currency)} </Text> here.</>
        : "You’re all square here."}
    </Text>
    <T kind="label" muted>{hubMoneyLine(owe, owed, commune.currency)}</T>
    {first ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/expense/${first.expenseId}`)} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{first.title}</T>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <T kind="label" muted>You owe {firstName(first.payerName)}</T>
            <State text={first.status.text} tone={first.status.tone} />
          </View>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(first.amountMinor, first.currency)}</T>
      </Pressable>
      <PayPrimary size="md" target={{ shareId: first.shareId, communeId: first.communeId, payerId: first.payerId, payerName: first.payerName, amountMinor: first.amountMinor, currency: first.currency, title: first.title }} />
      {shares.length > 1 ? <Button variant="quiet" size="sm" label={`${shares.length - 1} more to settle`} onPress={() => router.push("/settle")} /> : null}
    </View> : toConfirm?.debtor.pending ? <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{toConfirm.entry.title}</T>
          <T kind="label" muted>{firstName(toConfirm.debtor.name)} says they sent it</T>
        </View>
        <T kind="amount" style={{ fontSize: 19, lineHeight: 24 }}>{money(toConfirm.debtor.pending.amountMinor, commune.currency)}</T>
      </View>
      <Button block busy={busy} label={`Confirm ${money(toConfirm.debtor.pending.amountMinor, commune.currency)} received`} onPress={() => void confirm()} />
      <Button variant="quiet" size="sm" label="Not received" onPress={() => router.push("/settle")} />
    </View> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Button variant="secondary" size="sm" label="Add expense" icon={<Plus size={15} color={c.ink} />} onPress={() => router.push("/add-expense")} />
      <Button variant="quiet" size="sm" label="View settlement" onPress={() => router.push("/settle")} />
      {first && confirms.length ? <T kind="label" muted>{confirms.length} to confirm</T> : null}
    </View>
  </View>;
}

/** Late jobs first, then each day of the week that has something on it. Free days are left out. */
function WeekPanel() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const viewerId = user?.id ?? "";
  const value = week(current, viewerId, today);
  const days = value.days.filter((day, index) => index === 0 || day.items.length);
  const empty = !value.late.length && value.days.every((day) => !day.items.length);
  return <View style={{ gap: 12 }}>
    <SectionHead title="This week" right={<Button variant="quiet" size="sm" label="All tasks" onPress={() => router.push("/tasks")} />} />
    <Panel>
      {empty ? <Empty icon={<Check size={18} color={c.onSettled} />} title="Nothing planned for this week" body="Tasks, events and bills due will show here." /> : <>
        {value.late.length ? <DayHead first label="Late" count={value.late.length} late /> : null}
        {value.late.map((item) => <WeekRow key={item.key} item={item} late />)}
        {days.map((day, index) => <View key={day.date}>
          <DayHead first={!value.late.length && index === 0} date={day.date} label={day.date === today ? "Today" : day.date === addDays(today, 1) ? "Tomorrow" : undefined} />
          {day.items.length ? day.items.map((item) => <WeekRow key={item.key} item={item} />)
            : <T kind="label" muted style={{ paddingHorizontal: 16, paddingBottom: 12 }}>Nothing today.</T>}
        </View>)}
      </>}
    </Panel>
  </View>;
}

function DayHead({ date, label, count, late, first }: { date?: string; label?: string; count?: number; late?: boolean; first?: boolean }) {
  const { c } = useTheme();
  const { today } = useApp();
  const parts = date ? calParts(date, today) : null;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 4, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    {date ? <Cal iso={date} today={today} small /> : null}
    <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: "600", color: late ? c.late : c.ink }}>
      {label ?? `${parts?.dow} ${parts?.day} ${parts?.mon}`}{count != null ? <Text style={{ color: c.ink2, fontWeight: "500" }}>  {count}</Text> : null}
    </Text>
  </View>;
}

function WeekRow({ item, late }: { item: WeekItem; late?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user } = useApp();
  if (!current) return null;
  if (item.kind === "task" && item.operation) {
    const who = item.mine ? "You" : item.who;
    return <TaskCheck communeId={current.commune.id} operationId={item.operation.id} date={item.operation.date} title={item.title}
      assigneeId={item.assigneeId} assigneeName={item.assigneeId === user?.id ? user?.name ?? "You" : current.members.find((member) => member.userId === item.assigneeId)?.name ?? item.who}
      late={late} meta={late ? `${who} · late` : item.assigneeId ? who : "Nobody yet · tick it to take it"} />;
  }
  const bill = item.kind === "bill";
  const meta = bill
    ? `Bill due · ${money(item.amountMinor ?? 0, item.currency)}${item.yourShareMinor ? ` · your share ${money(item.yourShareMinor, item.currency)}` : item.mine ? " · you paid it" : ""}`
    : [item.operation?.time ? item.operation.time.slice(0, 5) : "", item.assigneeId ? item.who : ""].filter(Boolean).join(" · ") || "Event";
  const Icon = bill ? ReceiptText : CalendarDays;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${meta}`}
    onPress={() => (bill ? router.push(`/expense/${item.expenseId}`) : router.push("/tasks"))}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: pressed ? c.press : "transparent" })}>
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}><Icon size={15} color={c.ink2} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T kind="body" style={{ fontSize: 15, lineHeight: 21, fontWeight: "500" }}>{item.title}</T>
      <T kind="label" muted>{meta}</T>
    </View>
  </Pressable>;
}

/** Each person's balance with you here, and what they have on next. */
function PeoplePanel() {
  const { c } = useTheme();
  const router = useRouter();
  const { current, user, today } = useApp();
  if (!current) return null;
  const lines = people(current, user?.id ?? "", today);
  return <View style={{ gap: 12 }}>
    <SectionHead title="People" right={<Button variant="quiet" size="sm" label="Members" onPress={() => router.push("/members")} />} />
    <Panel>{lines.map((line, index) => <Pressable key={line.userId} accessibilityRole="button" accessibilityLabel={`${line.name}. ${line.balance}. ${line.job}.`}
      onPress={() => router.push("/settle")}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline, backgroundColor: pressed ? c.press : "transparent" })}>
      <Avatar name={line.isYou ? user?.name ?? "You" : line.name} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T kind="body" style={{ fontSize: 15, fontWeight: "500" }}>{line.name}</T>
        <T kind="label" muted lines={1}>{line.job}</T>
      </View>
      <T kind="label" color={line.coming ? c.action : c.ink} style={{ fontWeight: "600" }}>{line.balance}</T>
    </Pressable>)}</Panel>
  </View>;
}

/** The details people look up, with the facts in place. Passwords and codes stay hidden until asked for. */
function Essentials() {
  const router = useRouter();
  const { current } = useApp();
  if (!current) return null;
  const items = essentials(current);
  if (!items.length) return null;
  return <View style={{ gap: 12 }}>
    <SectionHead title="Shared essentials" right={<Button variant="quiet" size="sm" label="All notes" onPress={() => router.push("/notes")} />} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginRight: -16 }}>
      {items.map((item) => <EssentialCard key={item.id} item={item} />)}
    </ScrollView>
  </View>;
}

function EssentialCard({ item }: { item: Essential }) {
  const { c } = useTheme();
  const toast = useToast();
  const [shown, setShown] = useState(false);
  const secrets = item.facts.filter((fact) => fact.secret);
  const phone = item.facts.find((fact) => fact.phone);
  async function copy() {
    const text = (secrets[0] ?? item.facts[0])?.value ?? "";
    if (!text) return;
    await Clipboard.setStringAsync(text);
    tap();
    toast(`Copied ${(secrets[0] ?? item.facts[0])?.label.toLowerCase()}.`);
  }
  return <View style={{ width: 270, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.outline, padding: 14, gap: 8 }}>
    {item.category ? <T kind="note" muted style={{ fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>{item.category}</T> : null}
    <T kind="strong">{item.title}</T>
    {item.facts.length ? <View style={{ gap: 3 }}>{item.facts.map((fact) => <View key={fact.label} style={{ flexDirection: "row", gap: 12 }}>
      <T kind="label" muted style={{ width: 78 }}>{fact.label}</T>
      <T kind="label" style={{ flex: 1 }} >{fact.secret && !shown ? "••••••" : fact.value}</T>
    </View>)}</View> : <T kind="label" muted>{item.summary}</T>}
    {secrets.length || phone ? <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
      {secrets.length ? <>
        <Button size="sm" variant="secondary" label={shown ? "Hide" : "Show"} accessibilityLabel={`${shown ? "Hide" : "Show"} ${item.title} ${secrets[0].label.toLowerCase()}`}
          icon={shown ? <EyeOff size={14} color={c.ink} /> : <Eye size={14} color={c.ink} />} onPress={() => setShown(!shown)} />
        <Button size="sm" variant="secondary" label="Copy" accessibilityLabel={`Copy ${item.title} ${secrets[0].label.toLowerCase()}`} icon={<Copy size={14} color={c.ink} />} onPress={() => void copy()} />
      </> : null}
      {phone ? <Button size="sm" variant="secondary" label={`Call ${phone.label.toLowerCase()}`} icon={<Phone size={14} color={c.ink} />}
        onPress={() => void Linking.openURL(`tel:${phone.value.replace(/[^\d+]/g, "")}`)} /> : null}
    </View> : null}
  </View>;
}
