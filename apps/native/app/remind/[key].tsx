import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Clock3 } from "lucide-react-native";
import { money } from "../../src/lib/format";
import { reminderChoices } from "../../src/lib/remindTimes";
import { remindMe } from "../../src/lib/reminders";
import { usePrefs } from "../../src/prefs";
import { useApp } from "../../src/state";
import { FITTED, Panel, Row, T, tap } from "../../src/ui/kit";
import { Sheet } from "../../src/ui/sheet";
import { useToast } from "../../src/ui/toast";
import { useTheme } from "../../src/ui/theme";

/**
 * The drawer behind "Remind me" (and a long press on the row): remind me
 * tonight, tomorrow morning, or open the bill or chore now.
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
  const { needs } = useApp();
  const [need] = useState(() => needs.find((item) => item.key === key));
  const { remindHour } = usePrefs();
  const [choices] = useState(() => reminderChoices(new Date(), remindHour));
  if (!need) {
    return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 10 }]}>
      <T kind="title">Already done</T>
      <T kind="body" muted>This one is no longer waiting on you.</T>
    </View>;
  }
  const what = need.kind === "share" ? `${need.title}, your share ${money(need.amountMinor, need.currency)}` : `${need.title}, your turn`;
  async function pick(index: number) {
    const choice = choices[index];
    const body = need!.kind === "share" ? `Pay ${need!.payerName} ${money(need!.amountMinor, need!.currency)} for ${need!.title}.` : `Your turn: ${need!.title}.`;
    const result = await remindMe(choice.at, need!.title, body).catch(() => "failed" as const);
    if (result === "denied") { toast("Turn on notifications for Commune in Settings to get reminders."); return; }
    if (result === "failed") { toast("Couldn’t set the reminder. Try again."); return; }
    tap("light");
    toast(`We’ll remind you about ${need!.title.toLowerCase()} ${choice.words}.`);
    close();
  }
  const open = () => close(() => router.push(need.kind === "share" ? `/expense/${need.expenseId}` : "/tasks"));
  const icon = (node: React.ReactNode) => <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>{node}</View>;
  return <View style={[FITTED, { padding: 20, paddingTop: 12, gap: 14 }]}>
    <View>
      <T kind="title" accessibilityRole="header">{need.title}</T>
      <T kind="body" muted>{what}</T>
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
