import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, ChevronLeft, ImageIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { addDays, equalShares, firstName, money, parseAmount, shortDate, word } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, T, tap, FITTED, Panel } from "../src/ui/kit";
import { BigAmount, Chips, Field, People, PersonChip } from "../src/ui/form";
import { springs, useCalm } from "../src/ui/motion";
import { Keypad } from "../src/ui/keypad";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

const CATEGORIES = ["Bills", "Groceries", "Household", "Food", "Rent", "Travel", "Other"];
const STEPS = ["How much?", "What and who paid", "Who shares it", "Check and add"] as const;

/**
 * Add an expense to the commune in view, one step at a time in the same
 * drawer: the amount on the app's own keypad, what it was for and who paid,
 * who shares it, then a last look before adding. The steps slide sideways;
 * with Reduce Motion they fade.
 */
function AddBody({ close }: { close: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { current, user, today, addExpense, backend } = useApp();
  const people = current ? activeMembers(current) : [];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(user?.id ?? "");
  const [included, setIncluded] = useState<string[]>(people.map((member) => member.userId));
  const [category, setCategory] = useState("Other");
  const [due, setDue] = useState<string>(addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A receipt photo, and whether its details were read from it.
  const [photo, setPhoto] = useState<string | null>(null);
  const [reading, setReading] = useState<"idle" | "busy" | "read" | "manual">("idle");
  const [receiptDay, setReceiptDay] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  // Opened straight from a link, the account and commune can arrive after the
  // first render: the payer is still you and everyone still shares it.
  const everyone = people.map((member) => member.userId).join(",");
  useEffect(() => { if (!payer && user?.id) setPayer(user.id); }, [payer, user?.id]);
  useEffect(() => { if (!included.length && everyone) setIncluded(everyone.split(",")); }, [everyone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!current) return null;
  const currency = current.commune.currency;
  const minor = parseAmount(amount);
  const nameOf = (userId: string) => userId === user?.id ? "you" : firstName(people.find((member) => member.userId === userId)?.name ?? "");
  let shares: Array<{ userId: string; amountMinor: number }> | null = null;
  try { if (minor && included.length) shares = equalShares(minor, included); } catch { shares = null; }
  const valid = !!title.trim() && !!shares && !!payer;

  // "£10.80 each between four. Paid by you."
  let help = "Type the amount, then choose who shares it.";
  if (minor && !included.length) help = "Choose at least one person to share it.";
  else if (minor && !shares) help = "That’s less than a penny each.";
  else if (shares && minor) {
    const paidBy = `Paid by ${nameOf(payer)}.`;
    const high = shares[0].amountMinor;
    const low = shares[shares.length - 1].amountMinor;
    const each = high === low ? `${money(low, currency)} each` : `${money(low, currency)} or ${money(high, currency)} each`;
    help = shares.length === 1
      ? `All ${money(minor, currency)} on ${nameOf(shares[0].userId)}. ${paidBy}`
      : `${each} between ${shares.length < 10 ? word(shares.length) : shares.length}. ${paidBy}`;
  }

  async function snap(from: "camera" | "library") {
    setError("");
    try {
      const allowed = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!allowed.granted) {
        setError(from === "camera" ? "Allow the camera for Commune in Settings to scan receipts." : "Allow photos for Commune in Settings to choose a receipt.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
      const picked = from === "camera"
        ? await ImagePicker.launchCameraAsync(options).catch(() => ImagePicker.launchImageLibraryAsync(options))
        : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets?.[0]) return;
      const uri = picked.assets[0].uri;
      setPhoto(uri);
      tap("light");
      setReading("busy");
      try {
        const found = await backend.readReceipt(uri);
        if (found.amountMinor) setAmount((found.amountMinor / 100).toFixed(2));
        if (found.title) setTitle(found.title);
        if (found.date) { setReceiptDay(found.date); setDue(found.date); }
        setReading("read");
        tap("success");
      } catch {
        // Nothing reads receipts yet: the photo stays here and the details are typed in.
        setReading("manual");
      }
    } catch (cause) {
      setError(failure(cause, "Couldn’t open the camera. Try again."));
    }
  }
  const unsnap = () => { setPhoto(null); setReading("idle"); setReceiptDay(null); };

  async function save() {
    if (!valid || !shares || !minor) return;
    setBusy(true); setError("");
    try {
      const result = await addExpense(current!.commune.id, { title: title.trim(), amountMinor: minor, category, dueOn: due || null, paidByUserId: payer, shares });
      tap("success");
      toast(result === "queued"
        ? `Saved on this phone. ${title.trim()} goes to ${current!.commune.name} when you’re back online.`
        : `${title.trim()} added to ${current!.commune.name}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t add it. Try again."));
    } finally { setBusy(false); }
  }

  const toggle = (userId: string) => setIncluded(included.includes(userId)
    ? included.filter((value) => value !== userId)
    : people.map((member) => member.userId).filter((value) => value === userId || included.includes(value)));
  const label = (userId: string, name: string) => userId === user?.id ? "You" : firstName(name);
  const receipt = photo ? <Panel style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
    <Image source={{ uri: photo }} accessibilityLabel="Your receipt photo" style={{ width: 44, height: 58, borderRadius: 6, backgroundColor: c.recessed }} />
    <View style={{ flex: 1, minWidth: 0 }}>
      {reading === "busy"
        ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ActivityIndicator size="small" color={c.ink2} /><T kind="strong">Reading the receipt…</T></View>
        : <T kind="strong">{reading === "read" ? "Read from your receipt" : "Receipt attached"}</T>}
      {reading !== "busy" ? <T kind="label" muted>{reading === "read" ? "Check these before adding." : "Type the amount and what it was for."}</T> : null}
    </View>
    <View style={{ gap: 4 }}>
      <Button size="sm" variant="quiet" label="Retake" onPress={() => void snap("camera")} />
      <Button size="sm" variant="quiet" label="Remove" onPress={unsnap} />
    </View>
  </Panel>
    : <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}><Button block variant="secondary" label="Scan a receipt" icon={<Camera size={16} color={c.ink} />} onPress={() => void snap("camera")} /></View>
      <Button variant="secondary" label="Choose a photo" icon={<ImageIcon size={16} color={c.ink} />} accessibilityLabel="Choose a receipt photo" onPress={() => void snap("library")} />
    </View>;

  const dueText = due ? (due === today ? "Today" : shortDate(due)) : "No due date";
  const pages: ReactNode[] = [
    <View key="amount" style={{ gap: 18 }}>
      {receipt}
      <View style={{ gap: 2, paddingVertical: 4 }}>
        <BigAmount text={money(minor ?? 0, currency)} empty={!minor} label={`Amount, ${money(minor ?? 0, currency)}`} />
        <T kind="label" muted style={{ textAlign: "center" }}>{current.commune.name}</T>
      </View>
      <Keypad value={amount} onChange={setAmount} />
    </View>,
    <View key="what" style={{ gap: 18 }}>
      {photo ? receipt : null}
      <Field label="What was it for?" value={title} onChange={setTitle} placeholder="Big Tesco shop" />
      <People label="Who paid">
        {people.map((member) => <PersonChip key={member.userId} name={member.name} label={label(member.userId, member.name)}
          on={payer === member.userId} onPress={() => { tap("select"); setPayer(member.userId); }} />)}
      </People>
      <Chips label="Category" options={CATEGORIES.map((value) => [value, value])} chosen={[category]} onPick={setCategory} />
      <Chips label="Due" options={[...(receiptDay && receiptDay !== today ? [[receiptDay, `Receipt date, ${shortDate(receiptDay)}`] as [string, string]] : []),
        [today, "Today"], [addDays(today, 7), `In a week, ${shortDate(addDays(today, 7))}`], ["", "No due date"]]}
        chosen={[due]} onPick={setDue} />
    </View>,
    <View key="split" style={{ gap: 14 }}>
      <People label="Split equally between">
        {people.map((member) => <PersonChip key={member.userId} many name={member.name} label={label(member.userId, member.name)}
          on={included.includes(member.userId)} onPress={() => { tap("select"); toggle(member.userId); }} />)}
      </People>
      <T kind="note" muted accessibilityRole="text">{help}</T>
      {shares ? <Panel>{shares.map((share, index) => <ShareLine key={share.userId} first={index === 0}
        name={share.userId === user?.id ? "You" : people.find((member) => member.userId === share.userId)?.name ?? ""}
        amount={money(share.amountMinor, currency)} />)}</Panel> : null}
    </View>,
    <View key="check" style={{ gap: 14 }}>
      <View style={{ gap: 2, paddingVertical: 4 }}>
        <BigAmount text={money(minor ?? 0, currency)} empty={!minor} label={`Amount, ${money(minor ?? 0, currency)}`} />
        <T kind="label" muted style={{ textAlign: "center" }}>{title.trim() || "No name yet"} · {current.commune.name}</T>
      </View>
      <Panel>
        <CheckLine first label="Amount" value={money(minor ?? 0, currency)} onEdit={() => setStep(0)} />
        <CheckLine label="For" value={title.trim() || "Not named yet"} onEdit={() => setStep(1)} />
        <CheckLine label="Paid by" value={payer ? cap(nameOf(payer)) : "Nobody chosen"} onEdit={() => setStep(1)} />
        <CheckLine label="Category" value={category} onEdit={() => setStep(1)} />
        <CheckLine label="Due" value={dueText} onEdit={() => setStep(1)} />
        <CheckLine label="Split" value={shares ? `Equally between ${shares.length < 10 ? word(shares.length) : shares.length}` : "Nobody chosen"} onEdit={() => setStep(2)} />
      </Panel>
      {shares ? <Panel>{shares.map((share, index) => <ShareLine key={share.userId} first={index === 0}
        name={share.userId === user?.id ? "You" : people.find((member) => member.userId === share.userId)?.name ?? ""}
        amount={money(share.amountMinor, currency)} />)}</Panel> : null}
      <ErrorText>{error}</ErrorText>
    </View>,
  ];

  const ready = [!!minor, !!title.trim() && !!payer, !!shares, valid];
  const next = () => { tap("select"); setError(""); setStep(Math.min(step + 1, 3)); };
  const footer = step < 3
    ? <Button size="lg" block label="Next" disabled={!ready[step]} onPress={next} />
    : <Button size="lg" block label={minor ? `Add ${money(minor, currency)}` : "Add expense"} busy={busy} disabled={!valid} onPress={() => void save()} />;
  return <Steps step={step} title={STEPS[step]} onBack={() => setStep(step - 1)} onCancel={close} pages={pages} footer={footer} />;
}

function cap(text: string): string { return text ? text[0].toUpperCase() + text.slice(1) : text; }

/** A line on the last step: what it is, what was chosen, and Edit to go back to that step. */
function CheckLine({ label, value, onEdit, first }: { label: string; value: string; onEdit(): void; first?: boolean }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    <T kind="label" muted style={{ width: 72 }}>{label}</T>
    <T kind="body" style={{ flex: 1, fontWeight: "500" }} lines={2}>{value}</T>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={onEdit} hitSlop={8}>
      <T kind="label" color={c.action} style={{ fontWeight: "600" }}>Edit</T>
    </Pressable>
  </View>;
}

/** One person's share of the split. */
function ShareLine({ name, amount, first }: { name: string; amount: string; first?: boolean }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 16, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.outline }}>
    <T kind="body" style={{ flex: 1 }}>{name}</T>
    <T kind="body" style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{amount}</T>
  </View>;
}

/**
 * The step drawer: a steady height, Back (or Cancel) with the step's title and
 * four thin progress bars, the pages side by side sliding on the smooth
 * spring, and the step's button fixed at the bottom.
 */
function Steps({ step, title, onBack, onCancel, pages, footer }: {
  step: number; title: string; onBack(): void; onCancel(): void; pages: ReactNode[]; footer: ReactNode;
}) {
  const { c } = useTheme();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const { width: screen, height } = useWindowDimensions();
  const [width, setWidth] = useState(screen);
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(-step * width, springs.smooth); }, [step, width, x]);
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const page = (content: ReactNode, index: number) => <ScrollView key={index} style={{ width }} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
    importantForAccessibility={index === step ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={index !== step}>{content}</ScrollView>;
  return <View style={[FITTED, { height: Math.min(height * 0.88, 760), backgroundColor: c.canvas }]}>
    <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={step ? "Back" : "Cancel"} onPress={step ? onBack : onCancel} hitSlop={8}
          style={{ minWidth: 72, flexDirection: "row", alignItems: "center", gap: 2 }}>
          {step ? <ChevronLeft size={20} color={c.ink} style={{ marginLeft: -6 }} /> : null}
          <T kind="body" style={{ fontSize: 16 }}>{step ? "Back" : "Cancel"}</T>
        </Pressable>
        <T kind="strong" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }} lines={1}>{title}</T>
        <View style={{ minWidth: 72 }} accessible accessibilityLabel={`Step ${step + 1} of ${pages.length}`}><T kind="label" muted style={{ textAlign: "right" }}>{step + 1} of {pages.length}</T></View>
      </View>
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {pages.map((_, index) => <View key={index} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: index <= step ? c.action : c.recessed }} />)}
      </View>
    </View>
    <View style={{ flex: 1, overflow: "hidden", marginTop: 8 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {calm
        ? <Animated.View key={step} entering={FadeIn.duration(180)} style={{ flex: 1 }}>{page(pages[step], step)}</Animated.View>
        : <Animated.View style={[{ flexDirection: "row", width: width * pages.length, flex: 1 }, row]}>{pages.map(page)}</Animated.View>}
    </View>
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.outline }}>{footer}</View>
  </View>;
}

export default function AddExpense() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><AddBody close={() => setClosing(true)} /></Sheet>;
}
