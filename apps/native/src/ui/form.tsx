import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { longDate, shortDate } from "../lib/format";
import { monthGrid, monthStart, shiftMonth } from "../lib/month";
import { Text, TextInput } from "./text";
import { Avatar, T } from "./kit";
import { PressScale, haptic, useCalm } from "./motion";
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
      style={{ minHeight: multiline ? 96 : 48, paddingVertical: multiline ? 12 : 0, textAlignVertical: multiline ? "top" : "center", borderRadius: radius.control, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16, color: c.ink }} />
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

/**
 * Date choices: the quick chips, then "Pick a date", which opens a full month
 * calendar under the chips. A date picked there shows as its own chosen chip.
 * Pass "" as a value for "No due date" style options.
 */
export function DateChips({ label, options, chosen, onPick, min }: {
  label: string; options: Array<[string, string]>; chosen: string; onPick(value: string): void; min?: string;
}) {
  const { c } = useTheme();
  const calm = useCalm();
  const [open, setOpen] = useState(false);
  const preset = options.some(([value]) => value === chosen);
  const [month, setMonth] = useState(() => monthStart(chosen || min || options.find(([value]) => value)?.[0] || new Date().toISOString().slice(0, 10)));
  const chip = (key: string, text: string, on: boolean, onPress: () => void, icon?: ReactNode) =>
    <PressScale key={key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: on ? c.frame : c.surface, borderWidth: 1, borderColor: on ? c.frame : c.outline }}>
      {icon}<Text style={{ fontSize: 13.5, fontWeight: "500", color: on ? c.onFrame : c.ink }}>{text}</Text>
    </PressScale>;
  const pickedText = !preset && chosen ? shortDate(chosen) : "Pick a date";
  const weeks = monthGrid(month);
  const monthName = longDate(month).split(" ").slice(2).join(" ");
  const year = month.slice(0, 4);
  return <View style={{ gap: 8 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([value, text]) => chip(value || "none", text, chosen === value, () => { onPick(value); setOpen(false); }))}
      {chip("pick", pickedText, (!preset && !!chosen) || open, () => { haptic.select(); setOpen((now) => !now); },
        <CalendarDays size={15} color={(!preset && !!chosen) || open ? c.onFrame : c.ink} />)}
    </View>
    {open ? <Animated.View entering={calm ? undefined : FadeIn.duration(180)} accessibilityLabel="Calendar"
      style={{ marginTop: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => setMonth(shiftMonth(month, -1))}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} color={c.ink} /></Pressable>
        <T kind="strong" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }}>{monthName} {year}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => setMonth(shiftMonth(month, 1))}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><ChevronRight size={20} color={c.ink} /></Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <Text key={i} maxFontSizeMultiplier={1} style={{ flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: "600", color: c.ink2 }}>{day}</Text>)}
      </View>
      {weeks.map((week, w) => <View key={w} style={{ flexDirection: "row" }}>
        {week.map((iso, d) => {
          if (!iso) return <View key={d} style={{ flex: 1, height: 42 }} />;
          const on = iso === chosen;
          const isToday = iso === new Date().toISOString().slice(0, 10);
          const off = !!min && iso < min;
          return <Pressable key={d} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={longDate(iso)}
            onPress={() => { haptic.select(); onPick(iso); setOpen(false); }}
            style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.frame : "transparent", borderWidth: isToday && !on ? 1.5 : 0, borderColor: c.action }}>
              <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 15, fontWeight: on || isToday ? "600" : "400", color: on ? c.onFrame : off ? c.outline : c.ink, fontVariant: ["tabular-nums"] }}>{Number(iso.slice(8))}</Text>
            </View>
          </Pressable>;
        })}
      </View>)}
    </Animated.View> : null}
  </View>;
}

/** The v7 sheet header: Cancel on the left, the title centred, as in the pay sheet. */
export function SheetBar({ title, onCancel }: { title: string; onCancel(): void }) {
  return <View style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
    <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8} style={{ minWidth: 64 }}><T kind="body" style={{ fontSize: 16 }}>Cancel</T></Pressable>
    <T kind="strong" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }} lines={1}>{title}</T>
    <View style={{ minWidth: 64 }} />
  </View>;
}

/** The big centred amount (v7 `.amt`, DM Sans 500 44/48), grey while there is nothing to show. */
export function BigAmount({ text, empty, label }: { text: string; empty?: boolean; label?: string }) {
  const { c } = useTheme();
  return <Text accessibilityLabel={label} accessibilityLiveRegion="polite" numberOfLines={1} adjustsFontSizeToFit
    style={{ fontSize: 44, lineHeight: 48, fontWeight: "500", letterSpacing: -1.3, textAlign: "center", fontVariant: ["tabular-nums"], color: empty ? c.ink2 : c.ink }}>{text}</Text>;
}

/** A person as a pill: a 28 px avatar in a 38 px chip. A chip that is off sits at half strength. */
export function PersonChip({ name, label, on, onPress, many, detail }: {
  name: string; label: string; on: boolean; onPress(): void; many?: boolean; detail?: string;
}) {
  const { c } = useTheme();
  return <PressScale accessibilityRole={many ? "checkbox" : "radio"} accessibilityState={many ? { checked: on } : { selected: on }}
    accessibilityLabel={detail ? `${label}, ${detail}` : label} onPress={onPress}
    style={{ height: 38, paddingLeft: 5, paddingRight: 14, borderRadius: 19, flexDirection: "row", alignItems: "center", gap: 8, opacity: on ? 1 : 0.5,
      backgroundColor: c.surface, borderWidth: 1, borderColor: on ? c.ink : c.outline }}>
    <Avatar name={name} size={28} />
    <Text style={{ fontSize: 13.5, fontWeight: "500", color: c.ink }}>{label}</Text>
    {detail ? <Text style={{ fontSize: 13.5, color: c.ink2, fontVariant: ["tabular-nums"] }}>{detail}</Text> : null}
  </PressScale>;
}

/** A labelled group of person chips. */
export function People({ label, children }: { label: string; children: ReactNode }) {
  return <View style={{ gap: 8 }}>
    <T kind="label" style={{ fontWeight: "600" }}>{label}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
  </View>;
}

/** Label and value rows in one panel, such as How, When and Note. */
export function Facts({ rows }: { rows: Array<[string, string]> }) {
  const { c } = useTheme();
  return <View style={{ borderRadius: 14, borderWidth: 1, borderColor: c.outline, backgroundColor: c.surface }}>
    {rows.map(([label, value], index) => <View key={label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: index ? 1 : 0, borderTopColor: c.outline }}>
      <T kind="body" muted style={{ width: 52 }}>{label}</T>
      <T kind="body" style={{ flex: 1, textAlign: "right" }}>{value}</T>
    </View>)}
  </View>;
}
