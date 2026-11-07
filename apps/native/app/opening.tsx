import { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePrefs } from "../src/prefs";
import { useApp } from "../src/state";
import { todayIso } from "../src/lib/format";
import { arrivalFrom } from "../src/opening/engine";
import { OpeningFlow, type FlowData, type ScreenId } from "../src/opening/flow";
import { useOpening } from "../src/opening/store";
import { Intro, Invited, Launch, Pick } from "../src/opening/screensStart";
import { DemoMaths, DemoSettle, DemoSplit } from "../src/opening/screensDemo";
import { Code, Name, Phone, Signin, Signup } from "../src/opening/screensAccount";
import { InviteScreen, KindScreen, Loading, NameCommune, Plans, Reminders, Shares, Trial, Welcome } from "../src/opening/screensSetup";
import type { Kind } from "../src/opening/stories";

const SCREENS: Record<ScreenId, React.ComponentType> = {
  launch: Launch, pick: Pick, invited: Invited, intro: Intro,
  "demo-split": DemoSplit, "demo-maths": DemoMaths, "demo-settle": DemoSettle,
  signup: Signup, phone: Phone, code: Code, name: Name, signin: Signin,
  kind: KindScreen, "name-commune": NameCommune, shares: Shares, invite: InviteScreen, reminders: Reminders,
  plans: Plans, trial: Trial, welcome: Welcome, loading: Loading,
};
const KINDS: Record<Kind, "household" | "trip" | "workspace"> = { "A home": "household", "A trip": "trip", "A workspace": "workspace", "Something else": "household" };

/**
 * The opening flow, shown the first time Commune opens and from Help.
 * ?from= says how someone arrived: invite-home|trip|work for an invitation,
 * link-<story> for an ad or website link. Anything else is the App Store.
 */
export default function Opening() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { backend, status, refresh, setCurrent } = useApp();
  const { setDisplayName } = usePrefs();
  const opening = useOpening();

  const onFinish = useCallback(async (d: FlowData) => {
    // A live server signs in with the real sign-in screen.
    if (backend.mode === "server" && status === "signed-out") {
      opening.save({ done: true });
      router.replace("/sign-in");
      return;
    }
    if (d.name.trim() && !d.returning) setDisplayName(d.name.trim());
    if (d.mode === "new" && !d.returning) {
      let communeId: string | null = null;
      try {
        communeId = await backend.createCommune({ name: d.communeName.trim() || "Our commune", kind: KINDS[d.kind], currency: d.currency });
        await refresh();
        setCurrent(communeId);
      } catch { /* Home still opens; the commune can be made from the menu. */ }
      opening.save({ done: true, storyId: d.story.id, communeId, trialStart: todayIso(), plan: d.plan.n, storyCardClosed: false });
    } else {
      opening.save({ done: true });
    }
    router.replace("/(tabs)");
  }, [backend, status, refresh, setCurrent, setDisplayName, opening, router]);

  if (!opening.loaded) return null;
  return <OpeningFlow arrived={arrivalFrom(typeof from === "string" ? from : null)} screens={SCREENS} onFinish={onFinish} backendMode={backend.mode} />;
}
