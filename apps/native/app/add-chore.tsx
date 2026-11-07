import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { addDays, firstName, shortDate } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, FITTED, tap } from "../src/ui/kit";
import { Chips, Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";

/** Add a chore: on one person, taken in turns by everyone, or open to whoever gets to it. */
export default function AddChore() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const toast = useToast();
  const { backend, current, user, today, refresh } = useApp();
  const [title, setTitle] = useState("");
  const [who, setWho] = useState<string>("turns");
  const [when, setWhen] = useState<string>(today);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "monthly">("weekly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current) return null;
  const people = activeMembers(current);
  // Your turn first when it rotates, then everyone else in the order they joined.
  const rota = [...people.filter((member) => member.userId === user?.id), ...people.filter((member) => member.userId !== user?.id)].map((member) => member.userId);

  async function save() {
    if (!title.trim()) { setError("Say what needs doing."); return; }
    setBusy(true); setError("");
    try {
      await backend.addTask(current!.commune.id, {
        title: title.trim(), date: when, repeat, notes: null,
        assigneeId: who === "turns" ? rota[0] ?? null : who === "anyone" ? null : who,
        rotationIds: who === "turns" && repeat !== "none" && rota.length > 1 ? rota : null,
      });
      await refresh();
      tap("success");
      toast(`${title.trim()} added.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t add the chore. Try again."));
    } finally { setBusy(false); }
  }

  const saturday = addDays(today, (6 - new Date(`${today}T12:00:00`).getDay() + 7) % 7 || 7);
  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="Add a chore" sub={current.commune.name} onClose={close} />
    <Field label="What needs doing" value={title} onChange={setTitle} placeholder="Put the bins out" />
    <Chips label="Whose job" chosen={[who]} onPick={setWho} options={[
      ["turns", "Take turns"], ["anyone", "Anyone"],
      ...people.map((member) => [member.userId, member.userId === user?.id ? "You" : firstName(member.name)] as [string, string]),
    ]} note={who === "turns" ? `${people.length > 1 ? "Everyone takes a turn, starting with you." : "Just you for now."}` : undefined} />
    <Chips label="First due" chosen={[when]} onPick={setWhen} options={[
      [today, "Today"], [addDays(today, 1), "Tomorrow"], [saturday, `Sat ${shortDate(saturday)}`], [addDays(today, 7), `In a week`],
    ]} />
    <Chips label="Repeats" chosen={[repeat]} onPick={(value) => setRepeat(value as typeof repeat)} options={[["weekly", "Every week"], ["monthly", "Every month"], ["none", "Just once"]]} />
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Add chore" busy={busy} onPress={() => void save()} />
  </ScrollView>;
}
