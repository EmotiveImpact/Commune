import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { activeMembers } from "../src/lib/derive";
import { addDays, equalShares, firstName, money, parseAmount, shortDate } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, T, tap } from "../src/ui/kit";
import { useToast } from "../src/ui/toast";
import { radius, useTheme } from "../src/ui/theme";

const CATEGORIES = ["Bills", "Groceries", "Household", "Food", "Rent", "Travel", "Other"];

/** Add an expense to the commune in view, split equally between the people chosen. */
export default function AddExpense() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { current, user, today, addExpense } = useApp();
  const people = current ? activeMembers(current) : [];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(user?.id ?? "");
  const [included, setIncluded] = useState<string[]>(people.map((member) => member.userId));
  const [category, setCategory] = useState("Other");
  const [due, setDue] = useState<string | null>(addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  if (!current) return null;
  const currency = current.commune.currency;
  const minor = parseAmount(amount);
  let preview = "";
  try { if (minor) preview = `${money(equalShares(minor, included)[included.length - 1].amountMinor, currency)} each`; } catch { preview = ""; }

  async function save() {
    if (!title.trim()) { setError("Say what it was for."); return; }
    if (!minor) { setError("Enter the amount paid, for example 48.00."); return; }
    if (!included.length) { setError("Choose who shares it."); return; }
    let shares;
    try { shares = equalShares(minor, included); } catch (cause) { setError(failure(cause, "That split doesn’t work.")); return; }
    setBusy(true); setError("");
    try {
      await addExpense(current!.commune.id, { title: title.trim(), amountMinor: minor, category, dueOn: due, paidByUserId: payer, shares });
      tap("success");
      toast(`${title.trim()} added to ${current!.commune.name}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t add it. Try again."));
    } finally { setBusy(false); }
  }

  const input = { height: 46, borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.ink };
  const chip = (on: boolean) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" as const, backgroundColor: on ? c.frame : c.surface, borderWidth: 1, borderColor: on ? c.frame : c.outline });
  const chipText = (on: boolean) => ({ fontSize: 13.5, fontWeight: "500" as const, color: on ? c.onFrame : c.ink });
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.canvas }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 22, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T kind="title" accessibilityRole="header">Add an expense</T>
          <T kind="body" muted>{current.commune.name}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
          <X size={18} color={c.ink} />
        </Pressable>
      </View>
      <View style={{ gap: 6 }}>
        <T kind="label" style={{ fontWeight: "600" }}>What was it for?</T>
        <TextInput accessibilityLabel="What was it for?" value={title} onChangeText={setTitle} maxLength={80} placeholder="Big Tesco shop" placeholderTextColor={c.ink2} style={input} />
      </View>
      <View style={{ gap: 6 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Amount</T>
        <TextInput accessibilityLabel="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" placeholderTextColor={c.ink2} style={input} />
      </View>
      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Who paid</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {people.map((member) => <Pressable key={member.userId} accessibilityRole="radio" accessibilityState={{ selected: payer === member.userId }} onPress={() => setPayer(member.userId)} style={chip(payer === member.userId)}>
            <Text style={chipText(payer === member.userId)}>{member.userId === user?.id ? "You" : firstName(member.name)}</Text>
          </Pressable>)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Split equally between</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {people.map((member) => {
            const on = included.includes(member.userId);
            return <Pressable key={member.userId} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              onPress={() => setIncluded(on ? included.filter((value) => value !== member.userId) : people.map((p) => p.userId).filter((value) => value === member.userId || included.includes(value)))} style={chip(on)}>
              <Text style={chipText(on)}>{member.userId === user?.id ? "You" : firstName(member.name)}</Text>
            </Pressable>;
          })}
        </View>
        {preview ? <T kind="note" muted>{preview}{minor && included.length && minor % included.length ? ", the first people carry the spare penny" : ""}.</T> : null}
      </View>
      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Category</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={chip(category === value)}>
            <Text style={chipText(category === value)}>{value}</Text>
          </Pressable>)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T kind="label" style={{ fontWeight: "600" }}>Due</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[[today, "Today"], [addDays(today, 7), `In a week, ${shortDate(addDays(today, 7))}`], [null, "No due date"]].map(([value, label]) => {
            const on = due === value;
            return <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setDue(value)} style={chip(on)}>
              <Text style={chipText(on)}>{label}</Text>
            </Pressable>;
          })}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button size="lg" block label="Add expense" busy={busy} onPress={() => void save()} />
      <T kind="note" muted>Uneven splits, templates and receipts are on the web app for now.</T>
    </ScrollView>
  </KeyboardAvoidingView>;
}
