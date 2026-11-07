import { Image, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../ui/text";
import { PressScale, Still, haptic } from "../ui/motion";
import { useTheme } from "../ui/theme";
import { useApp } from "../state";
import { billInSentence, storyById } from "./engine";
import { IMAGES } from "./images";
import { CAST } from "./stories";
import { trialDay, useOpening } from "./store";

/**
 * Home after the opening flow: the story card ("From the story you saw")
 * while the new commune has no bills, and the free week while it lasts.
 */
export function OpeningCards() {
  const { c, dark } = useTheme();
  const router = useRouter();
  const { today, snapshotOf, setCurrent } = useApp();
  const opening = useOpening();
  const story = opening.storyId ? storyById(opening.storyId) : undefined;
  const snapshot = opening.communeId ? snapshotOf(opening.communeId) : undefined;
  const day = trialDay(opening.trialStart, today);
  const showStory = !!story && !!snapshot && snapshot.expenses.length === 0;
  if (!showStory && !day) return null;
  const pale = dark ? c.settled : "#dce8d3";
  return <Still index={0} style={{ gap: 12 }}>
    {showStory && story ? <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 12, flexDirection: "row", gap: 12, borderBottomWidth: 1, borderBottomColor: c.outline2 }}>
      <View style={{ width: 78, borderRadius: 16, overflow: "hidden", backgroundColor: c.recessed }}><Image source={IMAGES[story.bill.img]} resizeMode="cover" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.66, textTransform: "uppercase", color: c.action }}>From the story you saw</Text>
        <Text style={{ fontSize: 15, lineHeight: 19, fontWeight: "600", color: c.ink, marginTop: 6 }}>Add your first bill</Text>
        <Text style={{ fontSize: 12.5, lineHeight: 17.5, color: c.ink2, marginTop: 3 }}>{`${CAST[story.bill.payer].n} added ${billInSentence(story.bill.n)} and Commune split it in seconds. Yours works the same way.`}</Text>
        <PressScale accessibilityRole="button" onPress={() => { haptic.light(); setCurrent(snapshot!.commune.id); router.push("/add-expense"); }}
          style={{ alignSelf: "flex-start", marginTop: 9, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: pale }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.onSettled }}>Add a bill</Text>
        </PressScale>
      </View>
    </View> : null}
    {day ? <View accessible accessibilityLabel={`Your free week. Day ${day} of 7.`} style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: pale }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.onSettled }}>Your free week</Text>
        <Text style={{ fontSize: 14, color: c.onSettled }}>{`Day ${day} of 7`}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(27,67,50,0.15)", marginTop: 10, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${(day / 7) * 100}%`, borderRadius: 3, backgroundColor: c.action }} />
      </View>
    </View> : null}
  </Still>;
}
