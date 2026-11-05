import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReminderInput = {
  type: string;
  title: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
};
const destinations: Record<string, string> = {
  checkin: "checkin",
  affirmation: "affirmation",
  breathing: "breathing",
  selfcare: "plan",
  custom: "today",
};
export const reminderDestination = (type: string) =>
  destinations[type] || "today";

export async function scheduleReminder(
  reminder: ReminderInput,
): Promise<{ ids: string[]; permission: string }> {
  if (Platform.OS === "web") return { ids: [], permission: "web-preview" };
  if (!reminder.enabled) return { ids: [], permission: "disabled" };
  const generation = reminderGeneration;
  const assertCurrent = () => {
    if (generation !== reminderGeneration)
      throw new Error(
        "Your session changed. Save the reminder again in the current account.",
      );
  };
  // A prior account's bulk cancellation must settle before new schedules begin.
  await cancellationTail;
  assertCurrent();
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("wellness", {
      name: "Gentle reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  assertCurrent();
  let permission = await Notifications.getPermissionsAsync();
  assertCurrent();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  assertCurrent();
  if (!permission.granted)
    throw new Error(
      "Notifications are not allowed. Enable them in your phone settings, then try again.",
    );
  const ids: string[] = [];
  try {
    for (const day of reminder.days) {
      assertCurrent();
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "A moment for yourself",
            body: "Your Solace reminder is ready whenever you are.",
            data: { screen: reminderDestination(reminder.type) },
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1,
            hour: reminder.hour,
            minute: reminder.minute,
            channelId: "wellness",
          },
        }),
      );
      // Native calls may finish after logout's cancel-all call. Remove their
      // late IDs instead of returning a successful save to a stale editor.
      assertCurrent();
    }
    return { ids, permission: "granted" };
  } catch (error) {
    await cancelReminders(ids);
    throw error;
  }
}
export async function cancelReminders(ids: string[] = []) {
  if (Platform.OS !== "web")
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
}
// Every global cancellation invalidates work started by an earlier account.
// Serialize bulk cancellations so an older native call cannot cancel a later
// account's newly created schedules after that account begins restoring.
let reminderGeneration = 0;
let cancellationTail: Promise<void> = Promise.resolve();
let mapWriteTail: Promise<void> = Promise.resolve();
export async function cancelAllReminders() {
  const generation = ++reminderGeneration;
  if (Platform.OS !== "web") {
    const cancellation = cancellationTail.then(() =>
      Notifications.cancelAllScheduledNotificationsAsync(),
    );
    cancellationTail = cancellation.catch(() => {});
    await cancellation;
  }
  return generation;
}
const localKey = (userId: string) => `solace.device-reminders.${userId}`;
export async function deviceReminderIds(
  userId: string,
  id: string,
): Promise<string[]> {
  const map = JSON.parse(
    (await AsyncStorage.getItem(localKey(userId))) || "{}",
  );
  return map[id] || [];
}
export async function rememberDeviceSchedule(
  userId: string,
  id: string,
  ids: string[],
) {
  const map = JSON.parse(
    (await AsyncStorage.getItem(localKey(userId))) || "{}",
  );
  map[id] = ids;
  await AsyncStorage.setItem(localKey(userId), JSON.stringify(map));
}
export async function restoreDeviceReminders(userId: string, reminders: any[]) {
  if (Platform.OS === "web") return;
  // Schedules belong to the signed-in account and this device, not IDs copied from another phone.
  const generation = await cancelAllReminders();
  const isCurrent = () => generation === reminderGeneration;
  if (!isCurrent()) return;
  const map: Record<string, string[]> = {};
  const createdIds: string[] = [];
  const writeMapIfCurrent = async (value: string | null) => {
    const write = mapWriteTail.then(async () => {
      if (!isCurrent()) return;
      if (value === null) await AsyncStorage.removeItem(localKey(userId));
      else await AsyncStorage.setItem(localKey(userId), value);
    });
    mapWriteTail = write.catch(() => {});
    await write;
  };
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!isCurrent()) return;
    if (!permission.granted) {
      await writeMapIfCurrent(null);
      return;
    }
    for (const reminder of reminders) {
      if (!isCurrent()) {
        await cancelReminders(createdIds);
        return;
      }
      if (!reminder.enabled) continue;
      const result = await scheduleReminder(reminder);
      createdIds.push(...result.ids);
      if (!isCurrent()) {
        await cancelReminders(createdIds);
        return;
      }
      map[reminder.id] = result.ids;
    }
    await writeMapIfCurrent(JSON.stringify(map));
    if (!isCurrent()) await cancelReminders(createdIds);
  } catch (error) {
    // Only remove IDs made by this restore; another account may already be active.
    await cancelReminders(createdIds);
    if (isCurrent()) {
      await writeMapIfCurrent(null);
      throw error;
    }
  }
}
export async function testNotification() {
  if (Platform.OS === "web")
    throw new Error(
      "Reminder delivery needs the Android or iOS app. The browser can preview preferences only.",
    );
  const generation = reminderGeneration;
  const assertCurrent = () => {
    if (generation !== reminderGeneration)
      throw new Error(
        "Your session changed. Try the test again in the current account.",
      );
  };
  await cancellationTail;
  assertCurrent();
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("wellness", {
      name: "Gentle reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  assertCurrent();
  const permission = await Notifications.requestPermissionsAsync();
  assertCurrent();
  if (!permission.granted)
    throw new Error("Please allow notifications in your phone settings.");
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "A moment for yourself",
      body: "Tap to open your check-in.",
      data: { screen: "checkin" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: "wellness",
    },
  });
  if (generation !== reminderGeneration) {
    await cancelReminders([id]);
    assertCurrent();
  }
}
export function subscribeNotificationNavigation(
  navigate: (route: string) => void,
) {
  if (Platform.OS === "web") return () => {};
  let active = true;
  const handler = (response: Notifications.NotificationResponse) => {
    if (!active) return;
    const screen = response.notification.request.content.data?.screen;
    if (
      typeof screen === "string" &&
      Object.values(destinations).includes(screen)
    )
      navigate(screen);
  };
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  const listener =
    Notifications.addNotificationResponseReceivedListener(handler);
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handler(response);
    })
    .catch(() => {});
  return () => {
    active = false;
    listener.remove();
  };
}
