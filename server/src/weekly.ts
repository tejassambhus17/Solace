import { z } from "zod";
import { provider, type AIConfig } from "./ai.js";
import { structuredOutput } from "./moments.js";

type WellnessRecord = Record<string, unknown>;
export type WeeklyFacts = {
  checkins: number;
  completedSessions: number;
  minutes: number;
  reflections: number;
  helpfulSessions: number;
  days: string[];
};
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
export function weeklyFacts(
  data: {
    checkins: WellnessRecord[];
    sessions: WellnessRecord[];
    reflections: WellnessRecord[];
  },
  endDate: string,
  now = new Date(),
) {
  const end = calendarDay.parse(endDate);
  const startDate = new Date(`${end}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const start = startDate.toISOString().slice(0, 10);
  const within = (records: WellnessRecord[]) =>
    records.filter((record) => {
      const timestamp =
        typeof record.createdAt === "string"
          ? Date.parse(record.createdAt)
          : NaN;
      if (!Number.isFinite(timestamp) || timestamp > now.valueOf())
        return false;
      const day =
        typeof record.day === "string" &&
        calendarDay.safeParse(record.day).success
          ? record.day
          : new Date(timestamp).toISOString().slice(0, 10);
      return day >= start && day <= end;
    });
  const checkins = within(data.checkins);
  const completed = within(data.sessions).filter(
    (record) => record.completed === true,
  );
  const seconds = completed.reduce((sum, record) => {
    const duration = Number(
      record.durationSec ?? record.durationSeconds ?? record.duration ?? 0,
    );
    return (
      sum +
      (Number.isFinite(duration) && duration >= 0
        ? Math.min(7200, duration)
        : 0)
    );
  }, 0);
  const facts: WeeklyFacts = {
    checkins: checkins.length,
    completedSessions: completed.length,
    minutes: Math.floor(seconds / 60),
    reflections: within(data.reflections).length,
    helpfulSessions: completed.filter(
      (record) =>
        record.feedback === "Helped" || record.feedback === "A little",
    ).length,
    days: [
      ...new Set(
        checkins.map((record) =>
          typeof record.day === "string"
            ? record.day
            : String(record.createdAt).slice(0, 10),
        ),
      ),
    ].sort(),
  };
  return { facts, period: { start, end } };
}
export async function weeklyReflection(
  config: AIConfig,
  summary: ReturnType<typeof weeklyFacts>,
) {
  const { facts, period } = summary;
  const hasData =
    facts.checkins + facts.completedSessions + facts.reflections > 0;
  const factual = hasData
    ? `This week you recorded ${facts.checkins} check-in${facts.checkins === 1 ? "" : "s"}, completed ${facts.completedSessions} moment${facts.completedSessions === 1 ? "" : "s"}, and saved ${facts.reflections} reflection${facts.reflections === 1 ? "" : "s"}. Completed activities totalled ${facts.minutes} minute${facts.minutes === 1 ? "" : "s"}. You marked ${facts.helpfulSessions} completed ${facts.helpfulSessions === 1 ? "activity" : "activities"} helpful or a little helpful.`
    : "Your week is a fresh page. A check-in, a moment or a reflection will appear here when you choose to save one.";
  let invitation = hasData
    ? "What would you like to carry forward, and what would you like to make a little room for?"
    : "What would feel like a gentle place to begin?";
  let mode: "live" | "offline" = "offline";
  if (hasData && provider(config) === "live") {
    const schema = z
      .object({ invitation: z.string().trim().min(10).max(280) })
      .strict();
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const output = await structuredOutput(
      config,
      "solace_weekly_invitation",
      jsonSchema,
      "Write one optional, gentle reflection question from the supplied participation counts. No claims about mood, improvement, decline, health, diagnosis, emotional patterns, reasons or outcomes. Do not repeat or introduce numbers, dates or trends. Do not summarize private writing or invent memories. Ask what the person noticed or wants to make room for, without judging how much they did.",
      facts,
      250,
    );
    const parsed = schema.safeParse(output);
    if (
      !parsed.success ||
      /\d|\b(?:diagnos|depress|disorder|improv|declin|recover|clinical|cure|treat|pattern|trend|better|worse)/i.test(
        parsed.data.invitation,
      )
    )
      throw new Error("AI_INVALID_REFLECTION");
    invitation = parsed.data.invitation;
    mode = "live";
  } else if (hasData && config.mode === "live" && !config.apiKey)
    throw new Error("AI_NOT_CONFIGURED");
  return {
    provider: mode,
    reflection: `${factual}\n\n${invitation}`,
    facts,
    period,
    explanation:
      mode === "live"
        ? "The counts come from your saved records. AI helped phrase the optional reflection question; it does not assess your mental health."
        : "A factual summary of your saved records with a built-in reflection prompt. Live AI is off or there is not yet recorded activity to reflect on.",
  };
}
