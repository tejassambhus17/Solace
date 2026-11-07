import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRecordId, routes } from "./routes";

export type ReminderInput = {
  type: string;
  title: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  habitId?: string;
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
  const generation = reminderGeneration;
  await restorationTail;
  if (generation !== reminderGeneration)
    throw new Error(
      "Your session changed. Save the reminder again in the current account.",
    );
  return scheduleDeviceReminder(reminder);
}

async function scheduleDeviceReminder(
  reminder: ReminderInput,
  requestPermission = true,
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
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  assertCurrent();
  let permission = await Notifications.getPermissionsAsync();
  assertCurrent();
  if (!permission.granted && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  assertCurrent();
  if (!permission.granted)
    throw new Error(
      "Notifications are not allowed. Enable them in your phone settings, then try again.",
    );
  const ids: string[] = [];
  try {
    const time = {
      hour: reminder.hour,
      minute: reminder.minute,
      channelId: "wellness",
    };
    const triggers =
      reminder.habitId && reminder.days.length === 7
        ? [
            {
              type: Notifications.SchedulableTriggerInputTypes.DAILY as const,
              ...time,
            },
          ]
        : reminder.days.map((day) => ({
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY as const,
            weekday: day + 1,
            ...time,
          }));
    for (const trigger of triggers) {
      assertCurrent();
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "A moment for yourself",
            body: "Your Solace reminder is ready whenever you are.",
            data: reminder.habitId
              ? { screen: routes.habitDetails, id: reminder.habitId }
              : { screen: reminderDestination(reminder.type) },
            sound: "default",
          },
          trigger,
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
let restorationTail: Promise<void> = Promise.resolve();
let habitScheduleTail: Promise<unknown> = Promise.resolve();
function writeScheduleMap(update: () => Promise<void>) {
  const write = mapWriteTail.then(update);
  mapWriteTail = write.catch(() => {});
  return write;
}
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
async function readScheduleMap(
  userId: string,
): Promise<Record<string, string[]>> {
  const value = await AsyncStorage.getItem(localKey(userId));
  if (value) {
    try {
      const map = JSON.parse(value);
      if (map && typeof map === "object" && !Array.isArray(map))
        return Object.fromEntries(
          Object.entries(map).filter(
            (entry): entry is [string, string[]] =>
              Array.isArray(entry[1]) &&
              entry[1].every((id) => typeof id === "string"),
          ),
        );
    } catch {}
  }
  return {};
}
export async function deviceReminderIds(
  userId: string,
  id: string,
): Promise<string[]> {
  await restorationTail;
  await mapWriteTail;
  const map = await readScheduleMap(userId);
  return Object.hasOwn(map, id) ? map[id] : [];
}
export async function rememberDeviceSchedule(
  userId: string,
  id: string,
  ids: string[],
) {
  const generation = reminderGeneration;
  await restorationTail;
  await writeScheduleMap(async () => {
    const map = { ...(await readScheduleMap(userId)), [id]: ids };
    if (generation !== reminderGeneration)
      throw new Error(
        "Your session changed. Save the reminder again in the current account.",
      );
    if (!ids.length) delete map[id];
    if (Object.keys(map).length)
      await AsyncStorage.setItem(localKey(userId), JSON.stringify(map));
    else await AsyncStorage.removeItem(localKey(userId));
  });
}

export function syncHabitDeviceReminder(
  userId: string,
  localId: string,
  reminder: ReminderInput | null,
  requestPermission: boolean,
): Promise<string> {
  const generation = reminderGeneration;
  const work = habitScheduleTail.then(async () => {
    if (Platform.OS === "web") return reminder ? "web-preview" : "disabled";
    const assertCurrent = () => {
      if (generation !== reminderGeneration)
        throw new Error(
          "Your session changed. Try again in your current account.",
        );
    };
    const oldIds = await deviceReminderIds(userId, localId);
    assertCurrent();
    await cancelReminders(oldIds);
    assertCurrent();
    await rememberDeviceSchedule(userId, localId, []);
    assertCurrent();
    if (!reminder) return "disabled";
    const { ids, permission } = await scheduleDeviceReminder(
      reminder,
      requestPermission,
    );
    try {
      assertCurrent();
      await rememberDeviceSchedule(userId, localId, ids);
      assertCurrent();
      return permission;
    } catch (error) {
      await cancelReminders(ids);
      throw error;
    }
  });
  habitScheduleTail = work.catch(() => {});
  return work;
}
export function restoreDeviceReminders(userId: string, reminders: any[]) {
  const restore = restoreSchedules(userId, reminders);
  restorationTail = restore.catch(() => {});
  return restore;
}

async function restoreSchedules(userId: string, reminders: any[]) {
  if (Platform.OS === "web") return;
  // Schedules belong to the signed-in account and this device, not IDs copied from another phone.
  const generation = await cancelAllReminders();
  const isCurrent = () => generation === reminderGeneration;
  if (!isCurrent()) return;
  const map: Record<string, string[]> = {};
  const createdIds: string[] = [];
  const writeMapIfCurrent = (value: string | null) =>
    writeScheduleMap(async () => {
      if (!isCurrent()) return;
      if (value === null) await AsyncStorage.removeItem(localKey(userId));
      else await AsyncStorage.setItem(localKey(userId), value);
    });
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
      const result = await scheduleDeviceReminder(reminder, false);
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
const handledResponses = new Set<string>();
const responseKey = (response: Notifications.NotificationResponse) =>
  JSON.stringify([
    response.notification.request.identifier,
    response.notification.date,
    response.actionIdentifier,
  ]);

export function subscribeNotificationNavigation(
  navigate: (route: string, params?: { id: string }) => void,
) {
  if (Platform.OS === "web") return () => {};
  let active = true;
  const handler = (response: Notifications.NotificationResponse) => {
    if (!active) return;
    const data = response.notification.request.content.data;
    const screen = data?.screen;
    const habit = screen === routes.habitDetails && isRecordId(data?.id);
    if (
      typeof screen !== "string" ||
      (!habit && !Object.values(destinations).includes(screen))
    )
      return;
    const key = responseKey(response);
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
    if (handledResponses.size > 32) {
      const oldest = handledResponses.values().next().value;
      if (oldest !== undefined) handledResponses.delete(oldest);
    }
    if (habit) navigate(screen, { id: data.id as string });
    else navigate(screen);
    try {
      const last = Notifications.getLastNotificationResponse();
      if (last && responseKey(last) === key)
        Notifications.clearLastNotificationResponse();
    } catch {
      // In-memory deduplication still works when the native cache is unavailable.
    }
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
  let last: Notifications.NotificationResponse | null = null;
  try {
    last = Notifications.getLastNotificationResponse();
  } catch {}
  if (last) handler(last);
  return () => {
    active = false;
    listener.remove();
  };
}
