import type { ReactNode } from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import { Text, TextInput } from "./text";
import { T } from "./kit";
import { PressScale } from "./motion";
import { radius, useTheme } from "./theme";

/** A sheet's heading with its close button, as in the record and invite sheets. */
export function SheetHead({ title, sub, onClose }: { title: string; sub?: string; onClose(): void }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
    <View style={{ flex: 1 }}>
      <T kind="title" accessibilityRole="header">{title}</T>
      {sub ? <T kind="body" muted>{sub}</T> : null}
    </View>
    <PressScale scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
      <X size={18} color={c.ink} />
    </PressScale>
  </View>;
}

/** A labelled text box. */
export function Field({ label, value, onChange, placeholder, multiline, max = 80, autoFocus }: {
  label: string; value: string; onChange(value: string): void; placeholder?: string; multiline?: boolean; max?: number; autoFocus?: boolean;
}) {
  const { c } = useTheme();
  return <View style={{ gap: 6 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={max} placeholder={placeholder} placeholderTextColor={c.ink2}
      multiline={multiline} autoFocus={autoFocus}
      style={{ minHeight: multiline ? 88 : 46, paddingVertical: multiline ? 12 : 0, textAlignVertical: multiline ? "top" : "center", borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 12, fontSize: 16, color: c.ink }} />
  </View>;
}

/** A row of choice chips; one chosen (radio) or several (checkbox). */
export function Chips<V extends string>({ label, options, chosen, onPick, many, note }: {
  label: string; options: Array<[NoInfer<V>, string]>; chosen: V[]; onPick(value: V): void; many?: boolean; note?: ReactNode;
}) {
  const { c } = useTheme();
  return <View style={{ gap: 8 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([value, text]) => {
        const on = chosen.includes(value);
        return <PressScale key={value} accessibilityRole={many ? "checkbox" : "radio"} accessibilityState={many ? { checked: on } : { selected: on }} onPress={() => onPick(value)}
          style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center", backgroundColor: on ? c.frame : c.surface, borderWidth: 1, borderColor: on ? c.frame : c.outline }}>
          <Text style={{ fontSize: 13.5, fontWeight: "500", color: on ? c.onFrame : c.ink }}>{text}</Text>
        </PressScale>;
      })}
    </View>
    {note ? <T kind="note" muted>{note}</T> : null}
  </View>;
}
