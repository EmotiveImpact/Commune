import { useState, type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, UserPlus } from "lucide-react-native";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, Panel, T, tap } from "../src/ui/kit";
import { Field } from "../src/ui/form";
import { PressScale } from "../src/ui/motion";
import { Sheet } from "../src/ui/sheet";
import { CheckLine, Steps } from "../src/ui/steps";
import { useToast } from "../src/ui/toast";
import { KIND_NAME, KIND_PHOTO, radius, useTheme } from "../src/ui/theme";

type Kind = "household" | "workspace" | "trip";
type Currency = "GBP" | "EUR" | "USD";

const KINDS: Array<[Kind, string]> = [
  ["household", "A home you share: bills, rent and the chores rota."],
  ["workspace", "A studio or team: shared costs, supplies and jobs."],
  ["trip", "A holiday or weekend away: who paid for what."],
];
const CURRENCIES: Array<[Currency, string, string]> = [["GBP", "Pounds", "£"], ["EUR", "Euros", "€"], ["USD", "Dollars", "$"]];
const STEPS = ["What kind?", "Name it", "Money", "Check and create", "Ready"] as const;
const PLACEHOLDER: Record<Kind, [string, string, string]> = {
  household: ["22 Elm Road", "Address (optional)", "22 Elm Road, Walthamstow, London"],
  workspace: ["Studio East", "Address (optional)", "Unit 4, Hackney Wick"],
  trip: ["Lisbon in September", "Where to (optional)", "Lisbon, Portugal"],
};

/**
 * Start a new commune one step at a time: what kind it is, its name and
 * place, its currency, a last look, then a Ready page that offers to invite
 * people. You are its admin.
 */
export default function NewCommune() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [then, setThen] = useState<"hub" | "invite" | null>(null);
  const leave = () => {
    if (router.canGoBack()) router.back(); else router.replace("/");
    if (then) setTimeout(() => router.navigate(then === "invite" ? "/invite" : "/hub"), 30);
  };
  return <Sheet closing={closing} onClosed={leave}><Body close={(next) => { setThen(next ?? null); setClosing(true); }} /></Sheet>;
}

function Body({ close }: { close(next?: "hub" | "invite"): void }) {
  const { c } = useTheme();
  const toast = useToast();
  const { backend, refresh, setCurrent } = useApp();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<string | null>(null);
  const k = kind ?? "household";
  const money = CURRENCIES.find(([code]) => code === currency)!;

  async function create() {
    if (!kind || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const where = place.trim() || null;
      const id = await backend.createCommune({ name: name.trim(), kind, currency, address: kind === "trip" ? null : where, destination: kind === "trip" ? where : null });
      await refresh();
      setCurrent(id);
      setMade(name.trim());
      tap("success");
      setStep(4);
    } catch (cause) {
      setError(failure(cause, "Couldn’t create it. Try again."));
    } finally { setBusy(false); }
  }

  const tick = (on: boolean) => <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: on ? c.frame : "transparent", borderWidth: on ? 0 : 1.5, borderColor: c.outline }}>
    {on ? <Check size={14} color={c.onFrame} strokeWidth={2.6} /> : null}
  </View>;
  const card = (key: string, on: boolean, onPress: () => void, label: string, children: ReactNode) =>
    <PressScale key={key} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} scaleTo={0.985} onPress={() => { tap("select"); onPress(); }}
      style={{ borderRadius: radius.surface, borderWidth: on ? 2 : 1, borderColor: on ? c.frame : c.outline, backgroundColor: c.surface, overflow: "hidden" }}>
      {children}
    </PressScale>;

  const pages = [
    <View key="kind" style={{ gap: 12 }}>
      <T kind="body" muted>You’ll be its admin. You can change this later.</T>
      {KINDS.map(([value, line]) => card(value, kind === value, () => setKind(value), `${KIND_NAME[value]}. ${line}`,
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={{ uri: KIND_PHOTO[value] }} style={{ width: 104, height: 92, backgroundColor: c.recessed }} />
          <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 2 }}>
            <T kind="strong" style={{ fontSize: 16 }}>{KIND_NAME[value]}</T>
            <T kind="label" muted>{line}</T>
          </View>
          <View style={{ paddingRight: 14 }}>{tick(kind === value)}</View>
        </View>))}
    </View>,
    <View key="name" style={{ gap: 18 }}>
      <Image source={{ uri: KIND_PHOTO[k] }} style={{ height: 120, borderRadius: radius.surface, backgroundColor: c.recessed }} />
      <Field label="Name" value={name} onChange={setName} max={48} placeholder={PLACEHOLDER[k][0]} />
      <Field label={PLACEHOLDER[k][1]} value={place} onChange={setPlace} max={160} placeholder={PLACEHOLDER[k][2]} />
      <T kind="note" muted>Everyone in the commune sees its name{kind === "trip" ? " and where you’re going" : " and address"}.</T>
    </View>,
    <View key="money" style={{ gap: 12 }}>
      <T kind="body" muted>Each commune keeps one currency. Commune never adds different currencies together.</T>
      <Panel>
        {CURRENCIES.map(([code, label, sign], index) => <PressScale key={code} accessibilityRole="radio" accessibilityState={{ selected: currency === code }}
          onPress={() => { tap("select"); setCurrency(code); }} scaleTo={0.99}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 58, paddingHorizontal: 16,
            borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: c.outline, backgroundColor: pressed ? c.press : "transparent" })}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
            <T kind="strong" style={{ fontSize: 16 }}>{sign}</T>
          </View>
          <T kind="body" style={{ flex: 1, fontSize: 16, fontWeight: "500" }}>{label}</T>
          {tick(currency === code)}
        </PressScale>)}
      </Panel>
    </View>,
    <View key="check" style={{ gap: 14 }}>
      <View style={{ borderRadius: radius.surface, overflow: "hidden" }}>
        <Image source={{ uri: KIND_PHOTO[k] }} style={{ height: 132, backgroundColor: c.recessed }} />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(10,12,18,0.42)" }}>
          <T kind="label" color="#fff">{KIND_NAME[k]}{place.trim() ? ` · ${place.trim()}` : ""}</T>
          <T kind="title" color="#fff" lines={1}>{name.trim() || "No name yet"}</T>
        </View>
      </View>
      <Panel>
        <CheckLine first label="Kind" value={KIND_NAME[k]} onEdit={() => setStep(0)} />
        <CheckLine label="Name" value={name.trim() || "Not named yet"} onEdit={() => setStep(1)} />
        <CheckLine label={kind === "trip" ? "Where" : "Address"} value={place.trim() || "None"} onEdit={() => setStep(1)} />
        <CheckLine label="Currency" value={`${money[1]} (${money[2]})`} onEdit={() => setStep(2)} />
      </Panel>
      <T kind="note" muted>You’ll be the admin, so you can invite people and change these details.</T>
      <ErrorText>{error}</ErrorText>
    </View>,
    <View key="ready" style={{ gap: 18, alignItems: "center", paddingTop: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.settled, alignItems: "center", justifyContent: "center" }}>
        <Check size={30} color={c.onSettled} strokeWidth={2.4} />
      </View>
      <View style={{ gap: 6, alignItems: "center", paddingHorizontal: 8 }}>
        <T kind="title" style={{ textAlign: "center" }}>{made ?? name.trim()} is ready</T>
        <T kind="body" muted style={{ textAlign: "center" }}>Invite the people you share with. They’ll see the same bills, chores and notes.</T>
      </View>
    </View>,
  ];

  const ready = [!!kind, !!name.trim(), true, !!kind && !!name.trim()];
  const next = () => { tap("select"); setError(""); setStep(Math.min(step + 1, 3)); };
  const footer = step < 3 ? <Button size="lg" block label="Next" disabled={!ready[step]} onPress={next} />
    : step === 3 ? <Button size="lg" block label="Create commune" busy={busy} disabled={!ready[3]} onPress={() => void create()} />
      : <View style={{ gap: 8 }}>
        <Button size="lg" block label="Invite people" icon={<UserPlus size={18} color={c.onAction} />} onPress={() => close("invite")} />
        <Button size="lg" block variant="quiet" label="Not now" onPress={() => { toast(`${made} is ready. Invite people from the menu.`); close("hub"); }} />
      </View>;
  return <Steps step={step} title={STEPS[step]} count={4} locked={step === 4} onBack={() => setStep(step - 1)} onCancel={() => close()} pages={pages} footer={footer} />;
}
