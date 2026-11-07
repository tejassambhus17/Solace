import type { Habit } from "../server/src/habit-contract";
import { syncHabitDeviceReminder, type ReminderInput } from "./notifications";

const everyDay = [0, 1, 2, 3, 4, 5, 6];

export function habitReminderInput(
  habit: Habit,
): (ReminderInput & { id: string }) | null {
  if (!habit.reminderTime || habit.status !== "active") return null;
  const [hour, minute] = habit.reminderTime.split(":").map(Number);
  return {
    id: `habit:${habit.id}`,
    habitId: habit.id,
    type: "habit",
    title: "Habit reminder",
    hour,
    minute,
    days: habit.schedule.type === "weekdays" ? habit.schedule.days : everyDay,
    enabled: true,
  };
}

export async function reconcileHabitReminder(
  account: string,
  id: string,
  habit: Habit | null,
  requestPermission = false,
) {
  const reminder = habit && habitReminderInput(habit);
  try {
    const result = await syncHabitDeviceReminder(
      account,
      `habit:${id}`,
      reminder,
      requestPermission,
    );
    if (result === "web-preview")
      return "Reminder preference saved. Open Solace on a phone to receive reminders.";
    if (result === "granted") return "Reminder scheduled on this device.";
  } catch (error) {
    if (!reminder)
      return "Your habit was saved. Solace couldn’t remove the old reminder on this device.";
    if (
      error instanceof Error &&
      error.message.startsWith("Notifications are not allowed")
    )
      return "Reminder preference saved. Allow notifications in your phone settings, then retry here.";
    return "Reminder preference saved. Scheduling on this device needs another try.";
  }
}
