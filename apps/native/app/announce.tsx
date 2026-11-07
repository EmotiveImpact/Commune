import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { failure, useApp } from "../src/state";
import { Button, ErrorText, FITTED, tap } from "../src/ui/kit";
import { Chips, Field, SheetHead } from "../src/ui/form";
import { Sheet } from "../src/ui/sheet";
import { useToast } from "../src/ui/toast";

/** Post an announcement to everyone in the commune, shown on the Hub photo. */
export default function Announce() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return <Sheet closing={closing} onClosed={leave}><Body close={() => setClosing(true)} /></Sheet>;
}

function Body({ close }: { close(): void }) {
  const toast = useToast();
  const { backend, current, refresh } = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ack, setAck] = useState<"yes" | "no">("no");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!current) return null;

  async function save() {
    if (!title.trim()) { setError("Give it a headline."); return; }
    setBusy(true); setError("");
    try {
      await backend.announce(current!.commune.id, { title: title.trim(), body: body.trim(), needsAcknowledgement: ack === "yes" });
      await refresh();
      tap("success");
      toast(`Posted to everyone in ${current!.commune.name}.`);
      close();
    } catch (cause) {
      setError(failure(cause, "Couldn’t post it. Try again."));
    } finally { setBusy(false); }
  }

  return <ScrollView style={FITTED} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
    <SheetHead title="Announce" sub={`Everyone in ${current.commune.name} sees it on the Hub.`} onClose={close} />
    <Field label="Headline" value={title} onChange={setTitle} placeholder="Plumber coming Tuesday" />
    <Field label="Message (optional)" value={body} onChange={setBody} max={1000} multiline placeholder="Between 9 and 12. Someone needs to be in." />
    <Chips label="Ask everyone to say they’ve seen it" chosen={[ack]} onPick={(value) => setAck(value as typeof ack)} options={[["no", "No"], ["yes", "Yes"]]} />
    <ErrorText>{error}</ErrorText>
    <Button size="lg" block label="Post announcement" busy={busy} onPress={() => void save()} />
  </ScrollView>;
}
