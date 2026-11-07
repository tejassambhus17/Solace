const destinations = {
  today: { tab: "today", route: "today" },
  breathe: {
    tab: "today",
    route: "breathing",
    params: { durationSec: 180, source: "widget" },
  },
  affirmation: { tab: "today", route: "affirmation" },
  reminders: { tab: "profile", route: "reminders" },
} as const;

export function widgetDestination(url: string | null | undefined) {
  const match =
    /^solace:\/\/widget\/(today|breathe|affirmation|reminders)\/?$/.exec(
      url || "",
    );
  return match ? destinations[match[1] as keyof typeof destinations] : null;
}
