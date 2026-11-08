import { Linking } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { shareUrl } from "../lib/whatsapp";
import { Button } from "./kit";
import { useToast } from "./toast";
import { useTheme } from "./theme";

/**
 * Opens WhatsApp with a message ready for the person to send to whichever
 * chat they choose, usually the house group. Commune sends nothing itself.
 */
export function WhatsAppButton({ text, label = "Share to WhatsApp", accessibilityLabel, size = "sm", variant = "secondary", block }: {
  text: string; label?: string; accessibilityLabel?: string; size?: "sm" | "md"; variant?: "secondary" | "quiet"; block?: boolean;
}) {
  const { c } = useTheme();
  const toast = useToast();
  return <Button size={size} variant={variant} block={block} label={label} accessibilityLabel={accessibilityLabel ?? `${label}, opens WhatsApp`}
    icon={<MessageCircle size={15} color={c.ink} />}
    onPress={() => void Linking.openURL(shareUrl(text)).catch(() => toast("WhatsApp couldn’t be opened on this phone."))} />;
}
