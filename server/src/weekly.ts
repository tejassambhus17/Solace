import { z } from "zod";
import { provider, structuredOutput, type AIConfig } from "./generation.js";
import { hasWeeklyActivity, summarizeWeek } from "./weekly-facts.js";

type WellnessRecord = Record<string, unknown>;
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar day.");

export const weeklyTimeZone = z
  .string()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");

function calendarOffset(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const weeklyPeriodSchema = z
  .object({ start: calendarDay, end: calendarDay })
  .strict()
  .refine(
    ({ start, end }) =>
      new Date(`${end}T12:00:00Z`).getUTCDay() === 0 &&
      calendarOffset(end, -6) === start,
    "Choose a Monday-to-Sunday reflection week.",
  );

export function lastVisibleWeekEnd(today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return calendarOffset(today, (7 - weekday) % 7);
}

function dateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formattedDay(date: Date, formatter?: Intl.DateTimeFormat) {
  if (!formatter) return date.toISOString().slice(0, 10);
  const parts = formatter.formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function weeklyLocalToday(now: Date, timeZone?: string) {
  return formattedDay(now, timeZone ? dateFormatter(timeZone) : undefined);
}

export function weeklyFacts(
  data: {
    checkins: WellnessRecord[];
    sessions: WellnessRecord[];
    reflections: WellnessRecord[];
  },
  endDate: string,
  now = new Date(),
  view: { today?: string; timeZone?: string } = {},
) {
  const end = calendarDay.parse(endDate);
  const start = calendarOffset(end, -6);
  const formatter = view.timeZone ? dateFormatter(view.timeZone) : undefined;
  const within = (records: WellnessRecord[]) => {
    const seen = new Set<string>();
    return records.flatMap((record) => {
      const timestamp =
        typeof record.createdAt === "string"
          ? Date.parse(record.createdAt)
          : NaN;
      if (!Number.isFinite(timestamp) || timestamp > now.valueOf()) return [];
      const day =
        typeof record.day === "string" &&
        calendarDay.safeParse(record.day).success
          ? record.day
          : formattedDay(new Date(timestamp), formatter);
      if (day < start || day > end || (view.today && day > view.today))
        return [];
      if (typeof record.id === "string" && record.id) {
        if (seen.has(record.id)) return [];
        seen.add(record.id);
      }
      return [{ record, day }];
    });
  };
  const facts = summarizeWeek({
    checkins: within(data.checkins),
    sessions: within(data.sessions),
    reflections: within(data.reflections),
  });
  return { facts, period: { start, end } };
}
export async function weeklyReflection(
  config: AIConfig,
  summary: ReturnType<typeof weeklyFacts>,
  signal?: AbortSignal,
  canRetry?: () => boolean,
) {
  const { facts, period } = summary;
  const hasData = hasWeeklyActivity(facts);
  const factual = hasData
    ? `This week you recorded ${facts.checkins} check-in${facts.checkins === 1 ? "" : "s"}, completed ${facts.completedSessions} Moment${facts.completedSessions === 1 ? "" : "s"}, and saved ${facts.reflections} reflection${facts.reflections === 1 ? "" : "s"}. You recorded ${facts.minutes} mindful minute${facts.minutes === 1 ? "" : "s"}. You marked ${facts.helpfulSessions} Moment${facts.helpfulSessions === 1 ? "" : "s"} helpful or a little helpful.`
    : "Your week is a fresh page. A check-in, a moment or a reflection will appear here when you choose to save one.";
  let invitation = hasData
    ? "What would you like to carry forward, and what would you like to make a little room for?"
    : "What would feel like a gentle place to begin?";
  let mode: "live" | "offline" = "offline";
  if (hasData && (config.mode === "live" || provider(config) === "live")) {
    const schema = z
      .object({ invitation: z.string().trim().min(10).max(280) })
      .strict();
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const { days: _days, ...counts } = facts;
    const output = await structuredOutput(
      config,
      "solace_weekly_invitation",
      jsonSchema,
      "Write one optional, gentle reflection question from the supplied participation counts. Start with What, Which, or How and end with a single question mark. Keep it under 180 characters and use no other sentence-ending punctuation. For example: What would you like to make a little room for next? Ask what the person noticed or wants to make room for without judging participation. Do not repeat or introduce numbers or dates, summarize private writing, invent memories, or make claims about mood, health, diagnosis, reasons or outcomes. Avoid wording about patterns, trends, improvement, decline, treatment, better or worse, and avoid should or must.",
      counts,
      { maxTokens: 250, signal, canRetry },
    );
    const parsed = schema.safeParse(output);
    if (
      !parsed.success ||
      !/^(?:what|which|how|is there|would you|if you)\b[^.!?\r\n]*\?$/i.test(
        parsed.data.invitation,
      ) ||
      /\d|\b(?:diagnos|depress|disorder|improv|declin|recover|clinical|cure|treat|pattern|trend|better|worse|must|should|fail|lazy|missed|blame)/i.test(
        parsed.data.invitation,
      )
    )
      throw new Error("AI_INVALID_REFLECTION");
    invitation = parsed.data.invitation;
    mode = "live";
  }
  return {
    provider: mode,
    hasActivity: hasData,
    prompt: invitation,
    reflection: `${factual}\n\n${invitation}`,
    facts,
    period,
    explanation:
      mode === "live"
        ? "The counts come from your saved records. AI helped phrase the optional reflection question; it does not assess your mental health."
        : hasData
          ? "The counts come from your saved records. The reflection question is built into Solace."
          : "A guided prompt to help you get started. As you save activity, you can return here for a weekly summary.",
  };
}
