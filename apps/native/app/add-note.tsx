import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, FITTED, TextLink, tap } from "../src/ui/kit";
import { Chips, Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

const KINDS = ["Wi-Fi", "Codes", "Bins", "Contacts", "House rules", "Other"] as const;

/** Add a note to the commune in view: a title, what kind it is, a short line and labelled details. */
export default function AddNote() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { backend, current, refresh } = useApp();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Other");
  const [lede, setLede] = useState("");
  const [facts, setFacts] = useState<Array<[string, string]>>([["", ""]]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current) return null;

  async function save() {
    if (!title.trim()) { setError("Give the note a title."); return; }
    const kept = facts.map(([label, value]) => [label.trim(), value.trim()] as [string, string]).filter(([label, value]) => label || value);
    if (kept.some(([label, value]) => !label || !value)) { setError("Each detail needs a label and what it says."); return; }
    setBusy(true); setError("");
    try {
      await backend.addNote(current!.commune.id, { title: title.trim(), pill: kind === "Other" ? null : kind, lede: lede.trim() || null, body: null, facts: kept });
      await refresh();
      tap("success");
      toast(`${title.trim()} added to ${current!.commune.name}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t add the note. Try again."));
    } finally { setBusy(false); }
  }

  const set = (index: number, part: 0 | 1, value: string) => setFacts(facts.map((fact, i) => (i === index ? (part === 0 ? [value, fact[1]] : [fact[0], value]) : fact)));
  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="Add a note" sub={`Everyone in ${current.commune.name} can see it.`} onClose={close} />
    <Field label="Title" value={title} onChange={setTitle} placeholder="Wi-Fi and the router" autoFocus />
    <Chips label="What kind" options={KINDS.map((value) => [value, value])} chosen={[kind]} onPick={(value) => setKind(value as typeof kind)} />
    <Field label="A short line (optional)" value={lede} onChange={setLede} max={200} placeholder="Router is behind the TV" />
    <View style={{ gap: 10 }}>
      {facts.map(([label, value], index) => <View key={index} style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ width: 120 }}><Field label={index ? " " : "Details"} value={label} onChange={(v) => set(index, 0, v)} max={120} placeholder="Password" /></View>
        <View style={{ flex: 1 }}><Field label={index ? " " : " "} value={value} onChange={(v) => set(index, 1, v)} max={120} placeholder="What it says" /></View>
      </View>)}
      {facts.length < 8 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Plus size={15} color={c.ink} /><TextLink label="Add another detail" onPress={() => setFacts([...facts, ["", ""]])} />
      </View> : null}
    </View>
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Add note" busy={busy} onPress={() => void save()} />
  </ScrollView>;
}
