export function formatReminderTime(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  return digits.length < 3
    ? digits
    : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function validReminderTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

export type ReminderClockTime = { hour: number; minute: number };

export function toReminderClock12({ hour, minute }: ReminderClockTime) {
  return { hour: hour % 12 || 12, minute, period: hour >= 12 ? 1 : 0 };
}

export function fromReminderClock12({
  hour,
  minute,
  period,
}: ReturnType<typeof toReminderClock12>): ReminderClockTime {
  return { hour: (hour % 12) + period * 12, minute };
}

export function reminderClockLabel(time: ReminderClockTime) {
  const { hour, minute, period } = toReminderClock12(time);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period ? "PM" : "AM"}`;
}
