import { useState } from "react";
import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { failure, useApp } from "../src/state";
import { Body, Pad } from "../src/ui/chrome";
import { Chips, Field } from "../src/ui/form";
import { Button, ErrorText, Panel, Row, T, tap } from "../src/ui/kit";
import { useConfirm } from "../src/ui/confirm";
import { useToast } from "../src/ui/toast";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "../src/ui/theme";

type Kind = "household" | "workspace" | "trip";
type Currency = "GBP" | "EUR" | "USD";
const KINDS: Kind[] = ["household", "workspace", "trip"];
const CURRENCIES: Array<[Currency, string]> = [["GBP", "Pounds (£)"], ["EUR", "Euros (€)"], ["USD", "Dollars ($)"]];

/**
 * The commune's own details: its name, kind, place and currency. Admins can
 * change them; the currency is fixed once there are bills, because Commune
 * never mixes currencies. Anyone can leave from here.
 */
export default function CommuneSettings() {
  const { current } = useApp();
  if (!current) return <Body><Pad><T kind="body" muted>Choose a commune first.</T></Pad></Body>;
  // Starts again for another commune, so the fields always show the one you're in.
  return <Settings key={current.commune.id} />;
}

function Settings() {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { backend, current, user, snapshots, refresh, setCurrent } = useApp();
  const commune = current?.commune;
  const [name, setName] = useState(commune?.name ?? "");
  const [kind, setKind] = useState<Kind>((commune?.kind as Kind) ?? "household");
  const [place, setPlace] = useState((commune?.kind === "trip" ? commune?.destination : commune?.address) ?? "");
  const [currency, setCurrency] = useState<Currency>((commune?.currency as Currency) ?? "GBP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current || !commune) return <Body><Pad><T kind="body" muted>Choose a commune first.</T></Pad></Body>;
  const admin = commune.role === "admin";
  const locked = current.expenses.length > 0;
  const before = (commune.kind === "trip" ? commune.destination : commune.address) ?? "";
  const dirty = name.trim() !== commune.name || kind !== commune.kind || place.trim() !== before || currency !== commune.currency;

  async function save() {
    if (!name.trim()) { setError("Give it a name."); return; }
    setBusy(true); setError("");
    try {
      const where = place.trim() || null;
      await backend.updateCommune(commune!.id, {
        name: name.trim(), kind, currency,
        address: kind === "trip" ? commune!.address ?? null : where,
        destination: kind === "trip" ? where : commune!.destination ?? null,
        stayName: commune!.stayName ?? null, stayAddress: commune!.stayAddress ?? null,
      });
      await refresh();
      tap("success");
      toast("Saved. Everyone in the commune sees the change.");
    } catch (cause) {
      setError(failure(cause, "Couldn’t save that. Try again."));
    } finally { setBusy(false); }
  }

  async function leave() {
    if (!user) return;
    const ok = await confirm({ title: `Leave ${commune!.name}?`, yes: "Leave", destructive: true,
      message: "You’ll stop seeing its bills, chores and notes. What you paid and owe stays on record for everyone else." });
    if (!ok) return;
    setBusy(true); setError("");
    try {
      await backend.leaveCommune(commune!.id, user.id);
      const next = snapshots.find((item) => item.commune.id !== commune!.id);
      if (next) setCurrent(next.commune.id);
      await refresh();
      toast(`You’ve left ${commune!.name}.`);
      router.replace("/");
    } catch (cause) {
      setError(failure(cause, "Couldn’t leave. Try again."));
    } finally { setBusy(false); }
  }

  return <Body>
    <Pad gap={18}>
      <View style={{ borderRadius: radius.surface, overflow: "hidden" }}>
        <Image source={{ uri: KIND_PHOTO[kind] }} style={{ height: 120, backgroundColor: c.recessed }} />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(10,12,18,0.42)" }}>
          <T kind="label" color="#fff">{KIND_NAME[kind]}{place.trim() ? ` · ${place.trim()}` : ""}</T>
          <T kind="title" color="#fff" lines={1}>{name.trim() || commune.name}</T>
        </View>
      </View>
      {admin ? <>
        <Field label="Name" value={name} onChange={setName} max={48} />
        <Chips<Kind> label="Kind" options={KINDS.map((value) => [value, KIND_NAME[value]])} chosen={[kind]} onPick={setKind} />
        <Field label={kind === "trip" ? "Where to (optional)" : "Address (optional)"} value={place} onChange={setPlace} max={160} />
        {locked ? <Panel>
          <Row first title="Currency" right={<T kind="body" muted>{CURRENCIES.find(([code]) => code === commune.currency)?.[1] ?? commune.currency}</T>} />
        </Panel> : <Chips<Currency> label="Currency" options={CURRENCIES} chosen={[currency]} onPick={setCurrency} />}
        {locked ? <T kind="note" muted>The currency is fixed once there are bills, so amounts are never mixed.</T> : null}
        <ErrorText>{error}</ErrorText>
        <Button size="lg" block label="Save changes" busy={busy} disabled={!dirty} onPress={() => void save()} />
      </> : <>
        <Panel>
          <Row first title="Name" right={<T kind="body" muted>{commune.name}</T>} />
          <Row title="Kind" right={<T kind="body" muted>{KIND_NAME[commune.kind as Kind]}</T>} />
          <Row title={commune.kind === "trip" ? "Where" : "Address"} right={<T kind="body" muted lines={1}>{before || "None"}</T>} />
          <Row title="Currency" right={<T kind="body" muted>{CURRENCIES.find(([code]) => code === commune.currency)?.[1] ?? commune.currency}</T>} />
        </Panel>
        <T kind="note" muted>Only an admin can change these details.</T>
        <ErrorText>{error}</ErrorText>
      </>}
      <View style={{ height: 8 }} />
      <Button block variant="danger" label="Leave commune" disabled={busy} onPress={() => void leave()} />
    </Pad>
  </Body>;
}
