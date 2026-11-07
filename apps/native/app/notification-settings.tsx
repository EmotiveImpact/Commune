import { Linking, Platform, Switch, View } from "react-native";
import { Check } from "lucide-react-native";
import { hourWords, notifySummary, REMIND_HOURS } from "../src/lib/prefsStore";
import { NOTIFY_KINDS, usePrefs } from "../src/prefs";
import { Body, Pad } from "../src/ui/chrome";
import { Kicker, Panel, Row, T, TextLink, tap } from "../src/ui/kit";
import { Rise } from "../src/ui/motion";
import { useToast } from "../src/ui/toast";
import { useTheme } from "../src/ui/theme";

/**
 * Notification settings, opened from the gear on Notifications and from
 * Settings: which kinds you're told about, and when "Remind me tonight"
 * goes off. Kept on this phone.
 */
export default function NotificationSettings() {
  const { c } = useTheme();
  const toast = useToast();
  const { notify, setNotify, remindHour, setRemindHour } = usePrefs();
  return <View style={{ flex: 1, backgroundColor: c.canvas }}>
    <Body refresh={false}>
      <Pad gap={22}>
        <Rise index={0} style={{ gap: 8 }}>
          <Kicker>Send me a notification when · {notifySummary(notify).toLowerCase()}</Kicker>
          <Panel>{NOTIFY_KINDS.map((kind, index) => <Row key={kind.id} first={index === 0} title={kind.label}
            right={<Switch accessibilityLabel={kind.label} value={notify[kind.id]} onValueChange={(on) => { tap("select"); setNotify(kind.id, on); }}
              trackColor={{ true: c.action, false: c.recessed }} ios_backgroundColor={c.recessed} />} />)}</Panel>
        </Rise>
        <Rise index={1} style={{ gap: 8 }}>
          <Kicker>“Remind me tonight” goes off at</Kicker>
          <Panel>{REMIND_HOURS.map((hour, index) => <Row key={hour} first={index === 0}
            accessibilityLabel={`${hourWords(hour)}${remindHour === hour ? ", selected" : ""}`}
            onPress={() => { tap("select"); setRemindHour(hour); toast(`Evening reminders now go off at ${hourWords(hour)}.`); }}
            title={hourWords(hour)} meta={hour === 19 ? <T kind="label" muted style={{ fontSize: 12.5, lineHeight: 17 }}>The usual time</T> : undefined}
            right={remindHour === hour ? <Check size={18} color={c.action} /> : null} />)}</Panel>
          <T kind="note" muted style={{ paddingHorizontal: 4 }}>“Remind me tomorrow morning” is always 8am. Reminders stay on this phone; nobody else is told.</T>
        </Rise>
        <Rise index={2} style={{ gap: 8 }}>
          <Kicker>Quiet hours</Kicker>
          <Panel pad>
            <T kind="body" muted>Quiet hours follow your phone’s Focus settings. When Focus is on, Commune waits until it ends.</T>
            {Platform.OS === "ios" ? <TextLink label="Open iPhone Settings" onPress={() => void Linking.openSettings().catch(() => undefined)} /> : null}
          </Panel>
        </Rise>
        <T kind="note" muted style={{ paddingHorizontal: 4 }}>These choices are kept on this phone.</T>
      </Pad>
    </Body>
  </View>;
}
