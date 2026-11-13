import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Clock3 } from "lucide-react-native";
import { remindTarget } from "../../src/lib/remindKey";
import { reminderChoices } from "../../src/lib/remindTimes";
import { remindMe } from "../../src/lib/reminders";
import { usePrefs } from "../../src/prefs";
import { useApp } from "../../src/state";
import { FITTED, Panel, Row, T, tap } from "../../src/ui/kit";
import { Sheet } from "../../src/ui/sheet";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

/**
 * The drawer behind "Remind me": a swipe on a row, a press and hold on any
 * money or chore panel, or the Remind me buttons. Remind me tonight,
 * tomorrow morning, or open the bill or chore now. The key can be a need,
 * an expense, a chore or a repeating bill (see lib/remindKey).
 */
export default function Remind() {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [next, setNext] = useState<(() => void) | null>(null);
  const leave = () => {
    if (router.canGoBack()) router.back(); else router.replace("/");
    if (next) setTimeout(next, 30);
  };
  return <Sheet closing={closing} onClosed={leave}>
    <RemindBody close={(then) => { if (then) setNext(() => then); setClosing(true); }} />
  </Sheet>;
}

function RemindBody({ close }: { close: (then?: () => void) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { needs, snapshots, user } = useApp();
  const { remindHour } = usePrefs();
  // Worked out once, so the drawer keeps its words while it closes.
  const [target] = useState(() => remindTarget(String(key ?? ""), needs, snapshots, user?.id ?? ""));
  const [choices] = useState(() => reminderChoices(new Date(), remindHour));
  if (!target) {
    return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 10 }]}>
      <T kind="title">Nothing to remind you about</T>
      <T kind="body" muted>This one has gone from Commune.</T>
    </View>;
  }
  async function pick(index: number) {
    const choice = choices[index];
    const result = await remindMe(choice.at, target!.title, target!.body).catch(() => "failed" as const);
    if (result === "denied") { toast("Turn on notifications for Commune in Settings to get reminders."); return; }
    if (result === "failed") { toast("Couldn’t set the reminder. Try again."); return; }
    tap("light");
    toast(`We’ll remind you about ${target!.title} ${choice.words}.`);
    close();
  }
  const open = () => close(() => router.push(target.open as never));
  const icon = (node: React.ReactNode) => <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 14 }]}>
    <View>
      <T kind="title" accessibilityRole="header">{target.title}</T>
      <T kind="body" muted>{target.what}</T>
    </View>
    <Panel>
      {choices.map((choice, index) => <Row key={choice.id} first={index === 0} onPress={() => void pick(index)}
        left={icon(<Clock3 size={17} color={c.ink} />)} title={choice.label}
        meta={<T kind="label" muted>{choice.words[0].toUpperCase() + choice.words.slice(1)}</T>} />)}
      <Row onPress={open} left={icon(<ArrowRight size={17} color={c.ink} />)} title="Open" />
    </Panel>
    <T kind="label" muted style={{ paddingHorizontal: 4 }}>Reminders stay on this phone. Nobody else is told.</T>
  </View>;
}
