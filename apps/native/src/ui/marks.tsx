import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Landmark } from "lucide-react-native";
import type { PayProvider } from "../lib/payLinks";
import { useTheme } from "./theme";

/**
 * Small marks for the ways people pay, drawn here as the prototype draws
 * them. They are simple stand-ins, not the providers' official logo files.
 */
export function PayMark({ provider, size = 34 }: { provider: PayProvider; size?: number }) {
  const { c } = useTheme();
  if (provider === "bank") {
    return <View accessibilityLabel="Bank transfer" style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
      <Landmark size={size * 0.5} color={c.ink} />
    </View>;
  }
  const label = provider === "monzo" ? "Monzo" : provider === "paypal" ? "PayPal" : "Revolut";
  return <View accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size * 0.26, overflow: "hidden", borderWidth: provider === "paypal" ? 1 : 0, borderColor: c.outline }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {provider === "monzo" ? <>
        <Rect width={32} height={32} rx={8} fill="#14233C" />
        <Path d="M9.5 22.5v-12l6.5 7 6.5-7v12" fill="none" stroke="#FF4F40" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      </> : provider === "paypal" ? <>
        <Rect width={32} height={32} rx={8} fill="#ffffff" />
        <Path fill="#003087" d="M11.2 7h6.3c3.3 0 5 1.8 4.5 4.7-.6 3.4-3 5-6.3 5h-2.2l-1.1 6.3H8.6z" />
        <Path fill="#009CDE" d="M13.6 10.2h5.9c2.9 0 4.4 1.5 4 4.1-.6 3.1-2.8 4.6-5.8 4.6h-2l-.9 5.1h-3.6z" />
      </> : <>
        <Rect width={32} height={32} rx={8} fill="#191C1F" />
        <Path fill="#ffffff" fillRule="evenodd" d="M10 8h7.2c3.3 0 5.3 1.8 5.3 4.6 0 2.2-1.2 3.7-3.2 4.3l3.7 7.1h-3.6l-3.4-6.6h-2.8V24H10zm3.2 2.8v4.1h3.7c1.4 0 2.3-.8 2.3-2.1s-.9-2-2.3-2z" />
      </>}
    </Svg>
  </View>;
}
