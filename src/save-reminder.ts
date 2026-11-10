import { Platform } from "react-native";
import {
  cancelReminders,
  deviceReminderIds,
  rememberDeviceSchedule,
  scheduleReminder,
  type ReminderInput,
} from "./notifications";

type ReminderSaveInput = ReminderInput & { id: string; permission: string };

export function isMatchingReminder(
  saved: Record<string, unknown>,
  record: ReminderInput,
) {
  const days = saved.days;
  return (
    saved.type === record.type &&
    saved.title === record.title &&
    saved.hour === record.hour &&
    saved.minute === record.minute &&
    saved.enabled === record.enabled &&
    Array.isArray(days) &&
    days.length === record.days.length &&
    record.days.every((day) => days.includes(day))
  );
}

export async function saveReminder({
  owner,
  id,
  record,
  save,
  editing = false,
}: {
  owner: string;
  id: string;
  record: ReminderInput;
  save: (record: ReminderSaveInput) => Promise<{ id?: string }>;
  editing?: boolean;
}): Promise<{ message: string; deviceScheduled: boolean }> {
  if (!owner) throw new Error("Please sign in before saving a reminder.");
  const isWeb = Platform.OS === "web";
  const previousIds =
    editing && !isWeb ? await deviceReminderIds(owner, id) : [];
  const result = await scheduleReminder(record);
  let saved;
  try {
    // Keep device IDs out of the API record so the same ID and payload can
    // safely retry after a lost response.
    saved = await save({ id, ...record, permission: result.permission });
  } catch (error) {
    try {
      await cancelReminders(result.ids);
    } catch {
      throw new Error(
        "Solace couldn’t confirm the save or cancel the new device alerts. Restart Solace to refresh your reminder schedule.",
      );
    }
    throw error;
  }
  if (isWeb)
    return {
      message: "Preferences saved. Open the mobile app to schedule delivery.",
      deviceScheduled: false,
    };

  const savedId = saved.id ?? id;
  try {
    await rememberDeviceSchedule(owner, savedId, [
      ...previousIds,
      ...result.ids,
    ]);
    if (previousIds.length) {
      await cancelReminders(previousIds);
      await rememberDeviceSchedule(owner, savedId, result.ids);
    }
  } catch {
    return {
      message:
        "Preferences saved. Solace couldn’t verify the device schedule. Restart Solace to refresh your alerts.",
      deviceScheduled: false,
    };
  }
  const deviceScheduled = record.enabled && result.ids.length > 0;
  return {
    message: deviceScheduled
      ? "Reminder scheduled on this device."
      : record.enabled
        ? "Preferences saved. No device alert was scheduled."
        : "Reminder disabled.",
    deviceScheduled,
  };
}
