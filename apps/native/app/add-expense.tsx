import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { addDays, equalShares, firstName, money, parseAmount, shortDate, word } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, T, tap, Panel } from "../src/ui/kit";
import { BigAmount, Chips, DateChips, Field, People, PersonChip } from "../src/ui/form";
import { CheckLine, ShareLine, Steps, cap } from "../src/ui/steps";
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
      <DateChips label="Due" options={[...(receiptDay && receiptDay !== today ? [[receiptDay, `Receipt date, ${shortDate(receiptDay)}`] as [string, string]] : []),
        [today, "Today"], [addDays(today, 7), `In a week, ${shortDate(addDays(today, 7))}`], ["", "No due date"]]}
        chosen={due} onPick={setDue} />
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

export default function AddExpense() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><AddBody close={() => setClosing(true)} /></Sheet>;
}
