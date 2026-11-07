import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { FileText, Receipt, Search as Glass, SquareCheck, UsersRound, X } from "lucide-react-native";
import { search, type SearchHit } from "../lib/search";
import { useApp } from "../state";
import { useCalm } from "./motion";
import { useTheme } from "./theme";

type Icon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const HIT_ICON: Record<SearchHit["kind"], Icon> = { expense: Receipt, chore: SquareCheck, note: FileText, person: UsersRound };
const KIND_HEADING: Record<SearchHit["kind"], string> = { expense: "Bills", chore: "Chores and events", note: "Notes", person: "People" };

/** Where a result opens: the bill itself, or its list with that item first and marked. */
export function hitHref(hit: SearchHit): Href {
  if (hit.kind === "expense") return `/expense/${hit.id}`;
  const path = hit.kind === "chore" ? "/tasks" : hit.kind === "note" ? "/notes" : "/members";
  return { pathname: path, params: { focus: hit.id } };
}

/**
 * Search, opened from the glass in the top bar. The bar turns into the search
 * field with Cancel beside it, and results fill the screen below it, grouped
 * by kind. Cancel, opening a result, or tapping the empty screen before
 * typing anything closes it and clears what was typed.
 */
export function SearchScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const calm = useCalm();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { snapshots, current, setCurrent, user } = useApp();
  const [query, setQuery] = useState("");
  const input = useRef<TextInput>(null);
  const hits = useMemo(() => search(snapshots, query, user?.id), [snapshots, query, user?.id]);
  const typed = query.trim();

  useEffect(() => { if (!visible) setQuery(""); }, [visible]);

  const close = () => { Keyboard.dismiss(); setQuery(""); onClose(); };
  const open = (hit: SearchHit) => {
    if (hit.communeId !== current?.commune.id) setCurrent(hit.communeId);
    close();
    router.push(hitHref(hit));
  };

  let lastKind: SearchHit["kind"] | null = null;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent onShow={() => input.current?.focus()}>
    <Animated.View entering={calm ? undefined : FadeIn.duration(160)} style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ backgroundColor: c.frame, paddingTop: insets.top }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, gap: 4 }}>
          <Animated.View entering={calm ? undefined : FadeIn.duration(180)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 42, paddingLeft: 14, paddingRight: 6, borderRadius: 21, backgroundColor: c.canvas }}>
            <Glass size={19} color={c.ink} strokeWidth={2} />
            <TextInput ref={input} value={query} onChangeText={setQuery} autoFocus placeholder="Search Commune" placeholderTextColor={c.ink2}
              accessibilityLabel="Search bills, chores, notes and people" returnKeyType="search" autoCorrect={false} autoCapitalize="none"
              selectionColor={c.action} cursorColor={c.action} keyboardAppearance="light" underlineColorAndroid="transparent"
              style={[{ flex: 1, minWidth: 0, height: 42, color: c.ink, fontSize: 17, fontWeight: "500", paddingVertical: 0 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setQuery(""); input.current?.focus(); }} hitSlop={8}
              style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.ink2, alignItems: "center", justifyContent: "center" }}>
                <X size={13} color={c.canvas} strokeWidth={2.6} />
              </View>
            </Pressable> : null}
          </Animated.View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel search" onPress={close} hitSlop={6}
            style={({ pressed }) => ({ height: 44, paddingHorizontal: 12, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: c.onFrame, fontSize: 16 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
      {!typed ? <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={close} style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        <Text style={{ color: c.ink2, fontSize: 15, padding: 12 }}>Find bills, chores, notes and people. Try a name, an amount or who paid.</Text>
      </Pressable> : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 24 }}>
        {typed.length < 2
          ? <Text style={{ color: c.ink2, fontSize: 15, padding: 12 }}>Find bills, chores, notes and people. Try a name, an amount or who paid.</Text>
          : hits.length === 0
            ? <Text style={{ color: c.ink2, fontSize: 15, padding: 12 }}>Nothing matches “{typed}”.</Text>
            : hits.map((hit, index) => {
              const heading = hit.kind !== lastKind ? KIND_HEADING[hit.kind] : null;
              lastKind = hit.kind;
              const I = HIT_ICON[hit.kind];
              return <Animated.View key={`${hit.kind}-${hit.communeId}-${hit.id}`} entering={calm ? undefined : FadeInUp.delay(Math.min(index, 8) * 25).springify().damping(22)}>
                {heading ? <Text accessibilityRole="header" style={{ color: c.ink2, fontSize: 13, fontWeight: "600", paddingHorizontal: 12, paddingTop: index ? 18 : 6, paddingBottom: 4 }}>{heading}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`${hit.title}. ${hit.meta}`} onPress={() => open(hit)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 58, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? c.press : "transparent" })}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.recessed, alignItems: "center", justifyContent: "center" }}>
                    <I size={18} color={c.ink} strokeWidth={1.7} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: c.ink, fontSize: 16, fontWeight: "500" }}>{hit.title}</Text>
                    <Text numberOfLines={1} style={{ color: c.ink2, fontSize: 13.5, marginTop: 1 }}>{hit.meta}</Text>
                  </View>
                </Pressable>
              </Animated.View>;
            })}
      </ScrollView>}
    </Animated.View>
  </Modal>;
}
