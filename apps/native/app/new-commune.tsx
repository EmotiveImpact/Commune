import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, FITTED, tap } from "../src/ui/kit";
import { Chips, Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";

type Kind = "household" | "workspace" | "trip";
type Currency = "GBP" | "EUR" | "USD";

/** Start a new commune: a name, what kind it is and its currency. You are its admin. */
export default function NewCommune() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const leave = () => {
    if (router.canGoBack()) router.back(); else router.replace("/");
    if (opened) setTimeout(() => router.navigate("/hub"), 30);
  };
  return <Sheet closing={closing} onClosed={leave}><Body close={(id) => { setOpened(id ?? null); setClosing(true); }} /></Sheet>;
}

function Body({ close }: { close(openedId?: string): void }) {
  const toast = useToast();
  const { backend, refresh, setCurrent } = useApp();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("household");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Give it a name."); return; }
    setBusy(true); setError("");
    try {
      const id = await backend.createCommune({ name: name.trim(), kind, currency });
      await refresh();
      setCurrent(id);
      tap("success");
      toast(`${name.trim()} is ready. Invite people from the menu.`);
      close(id);
    } catch (cause) {
      setError(failure(cause, "Couldn’t create it. Try again."));
    } finally { setBusy(false); }
  }

  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="New commune" sub="A home, a team or a trip. You can invite people next." onClose={() => close()} />
    <Field label="Name" value={name} onChange={setName} max={48} placeholder="22 Elm Road" autoFocus />
    <Chips label="What is it?" chosen={[kind]} onPick={(value) => setKind(value as Kind)}
      options={[["household", "Household"], ["workspace", "Workspace"], ["trip", "Trip"]]} />
    <Chips label="Currency" chosen={[currency]} onPick={(value) => setCurrency(value as Currency)}
      options={[["GBP", "Pounds"], ["EUR", "Euros"], ["USD", "Dollars"]]} />
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Create commune" busy={busy} onPress={() => void save()} />
  </ScrollView>;
}
