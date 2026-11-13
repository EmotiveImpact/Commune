import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * A reminder for yourself, kept on this phone as a local notification. It
 * reaches no one else and nothing is stored in Commune.
 */
let ready = false;

export async function remindMe(at: Date, title: string, body: string): Promise<"set" | "denied" | "web"> {
  // The web preview has no notifications; it behaves as if the reminder was set.
  if (Platform.OS === "web") return "web";
  if (!ready) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    ready = true;
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return "denied";
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return "set";
}
