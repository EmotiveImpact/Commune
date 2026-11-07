import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { Mail } from "lucide-react-native";
import { Body, Pad } from "../src/ui/chrome";
import { Button, Panel, T, TextLink } from "../src/ui/kit";
import { useTheme } from "../src/ui/theme";

const SUPPORT = "support@ourcommune.io";

/** Help and feedback: what Commune does, and a way to write to us. */
export default function Help() {
  const { c } = useTheme();
  const router = useRouter();
  return <Body>
    <Pad>
      <Panel pad>
        <T kind="strong">What Commune does</T>
        <T kind="body" muted>Commune records what people in a household, workspace or trip spend and pay each other. It never moves money. You pay in your own app, then record it here, and the person you paid confirms it.</T>
      </Panel>
      <Panel pad>
        <T kind="strong">Questions or ideas</T>
        <T kind="body" muted>Write to us at {SUPPORT}.</T>
        <Button variant="secondary" label="Email us" icon={<Mail size={15} color={c.ink} />} onPress={() => void Linking.openURL(`mailto:${SUPPORT}?subject=Commune%20for%20iPhone`).catch(() => undefined)} />
      </Panel>
      <TextLink label="Preview joining from an invitation" centred muted onPress={() => router.push("/join/demo")} />
    </Pad>
  </Body>;
}
