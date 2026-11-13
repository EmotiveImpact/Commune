import { useState } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { activeMembers } from "../src/lib/derive";
import { addDays, firstName, shortDate } from "../src/lib/format";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, FITTED, tap } from "../src/ui/kit";
import { Chips, DateChips, Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useConfirm } from "../src/ui/confirm";
import { useToast } from "../src/ui/toast";

/**
 * Add a chore: on one person, taken in turns by everyone, or open to whoever
 * gets to it. Opened with ?id= it edits that chore instead, from the version
 * you opened, and can remove it.
 */
export default function AddChore() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  // Opened straight from a link, the chore may arrive after the first draw: the form starts again once, when it does.
  const { current } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [seen, setSeen] = useState(false);
  if (!seen && id && current?.operations?.some((item) => item.id === id)) setSeen(true);
  return <Sheet closing={closing} onClosed={leave}><Body key={seen ? "found" : "waiting"} close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { backend, current, user, today, refresh } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Kept as it was when the sheet opened, so a refresh mid-edit can't move the version under you.
  const [editing] = useState(() => (id ? current?.operations?.find((item) => item.id === id) ?? null : null));
  const [title, setTitle] = useState(editing?.title ?? "");
  const [who, setWho] = useState<string>(editing ? ((editing.rotationIds?.length ?? 0) > 1 ? "turns" : editing.assigneeId ?? "anyone") : "turns");
  const [when, setWhen] = useState<string>(editing?.date ?? today);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "monthly">(editing?.repeat ?? "weekly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current) return null;
  const people = activeMembers(current);
  // Your turn first when it rotates, then everyone else in the order they joined.
  const rota = [...people.filter((member) => member.userId === user?.id), ...people.filter((member) => member.userId !== user?.id)].map((member) => member.userId);

  async function save() {
    if (!title.trim()) { setError("Say what needs doing."); return; }
    setBusy(true); setError("");
    // Editing a rota keeps its order and whose turn it is; a new one starts with you.
    const order = editing && (editing.rotationIds?.length ?? 0) > 1 ? editing.rotationIds! : rota;
    const fields = {
      title: title.trim(), date: when, repeat, notes: editing?.notes ?? null,
      assigneeId: who === "turns" ? (editing?.assigneeId && order.includes(editing.assigneeId) ? editing.assigneeId : order[0] ?? null) : who === "anyone" ? null : who,
      rotationIds: who === "turns" && repeat !== "none" && order.length > 1 ? order : null,
    };
    try {
      if (editing) await backend.updateTask(editing, { ...fields, expectedVersion: editing.version ?? 1 });
      else await backend.addTask(current!.commune.id, fields);
      await refresh();
      tap("success");
      toast(editing ? `${title.trim()} saved.` : `${title.trim()} added.`);
      close();
    } catch (cause) {
      setError(failure(cause, editing ? "Couldn’t save the chore. Try again." : "Couldn’t add the chore. Try again."));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!editing) return;
    if (!(await confirm({ title: `Remove ${editing.title}?`, message: "It leaves the list for everyone. Its history is kept.", yes: "Remove", destructive: true }))) return;
    setBusy(true); setError("");
    try {
      await backend.removeTask(editing.id);
      await refresh();
      tap("success");
      toast(`${editing.title} removed.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t remove it. Try again."));
    } finally { setBusy(false); }
  }

  const saturday = addDays(today, (6 - new Date(`${today}T12:00:00`).getDay() + 7) % 7 || 7);
  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title={editing ? "Edit chore" : "Add a chore"} sub={current.commune.name} onClose={close} />
    <Field label="What needs doing" value={title} onChange={setTitle} placeholder="Put the bins out" />
    <Chips label="Whose job" chosen={[who]} onPick={setWho} options={[
      ["turns", "Take turns"], ["anyone", "Anyone"],
      ...people.map((member) => [member.userId, member.userId === user?.id ? "You" : firstName(member.name)] as [string, string]),
    ]} note={who === "turns" ? `${people.length > 1 ? "Everyone takes a turn, starting with you." : "Just you for now."}` : undefined} />
    <DateChips label={editing ? "Next due" : "First due"} chosen={when} onPick={setWhen} min={editing && editing.date < today ? editing.date : today} options={[
      [today, "Today"], [addDays(today, 1), "Tomorrow"], [saturday, `Sat ${shortDate(saturday)}`], [addDays(today, 7), `In a week`],
    ]} />
    <Chips label="Repeats" chosen={[repeat]} onPick={(value) => setRepeat(value as typeof repeat)} options={[["weekly", "Every week"], ["monthly", "Every month"], ["none", "Just once"]]} />
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label={editing ? "Save chore" : "Add chore"} busy={busy} onPress={() => void save()} />
    {editing ? <Button block variant="danger" label="Remove chore" disabled={busy} onPress={() => void remove()} /> : null}
  </ScrollView>;
}
