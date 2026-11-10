import assert from "node:assert/strict";
import { test } from "node:test";
import { readAppAction } from "../src/companion-app-action.js";
import {
  appActionSupportsPracticeHandoff,
  resolveExplicitAppAction,
  validateAppAction,
} from "../src/companion-action-intent.js";

const id = "00000000-0000-4000-8000-000000000001";

test("practice handoff binds accepted exact durations to the current offer and keeps legacy support", () => {
  const now = 1_000_000;
  for (const command of [
    "I’m overwhelmed and only have one minute.",
    "Start a one-minute breathing exercise.",
    "Please help me calm down.",
    "Start a 60-second breathing reset.",
  ]) {
    const offered = resolveExplicitAppAction(command, undefined, now, true);
    assert.deepEqual(offered?.action, {
      id: offered?.action?.id,
      kind: "practice-start",
      practice: "breathing",
      minutes: 1,
    });
    assert.match(offered?.reply ?? "", /one-minute/);
    assert.equal(offered?.draft?.kind, "proposal");
    assert.equal(appActionSupportsPracticeHandoff(offered!.action), false);
    const confirmation = resolveExplicitAppAction(
      "Yes, start it.",
      offered?.draft,
      now,
      true,
    );
    assert.deepEqual(confirmation?.action, {
      id: confirmation?.action?.id,
      kind: "confirm",
      targetId: offered?.action?.id,
    });
    assert.equal(
      resolveExplicitAppAction("Yes", offered?.draft, now + 11 * 60_000, true),
      undefined,
    );
    assert.equal(
      resolveExplicitAppAction("Not now", offered?.draft, now, true)?.action
        ?.kind,
      "cancel",
    );
  }
  assert.equal(
    resolveExplicitAppAction(
      "Start a five-minute breathing exercise.",
      undefined,
      now,
    )?.draft,
    undefined,
  );
  assert.equal(
    resolveExplicitAppAction("Open Five Senses.", undefined, now, true)?.action
      ?.kind,
    "practice-start",
  );
  assert.equal(
    resolveExplicitAppAction("Start a sleep wind-down.", undefined, now, true)
      ?.action?.kind,
    "practice-start",
  );
  assert.equal(
    resolveExplicitAppAction("Show my habit progress.", undefined, now, true)
      ?.action?.kind,
    "navigate",
  );
  assert.equal(
    resolveExplicitAppAction(
      "Start a 2-minute grounding practice.",
      undefined,
      now,
      true,
    )?.action,
    undefined,
  );
  assert.equal(
    resolveExplicitAppAction(
      "Start a 1.5 minute breathing practice.",
      undefined,
      now,
      true,
    )?.action,
    undefined,
  );
  assert.equal(
    readAppAction({
      id,
      kind: "practice-start",
      practice: "grounding",
      minutes: 1,
    }),
    undefined,
  );
});

test("clarification follows the owned active draft, preserves reminders and needs a current explicit confirmation", () => {
  const now = 1_000_000;
  const start = resolveExplicitAppAction(
    "Create a habit for walking",
    undefined,
    now,
  );
  assert.equal(start?.draft?.kind, "habit");
  assert.equal(resolveExplicitAppAction("Daily", undefined, now), undefined);
  assert.equal(
    resolveExplicitAppAction("Daily", start?.draft, now + 11 * 60_000),
    undefined,
  );
  const days = resolveExplicitAppAction(
    "Monday through Wednesday",
    start?.draft,
    now,
  );
  const reminder = resolveExplicitAppAction("At 7 AM", days?.draft, now);
  assert.deepEqual(reminder?.action, {
    id: reminder?.action?.id,
    kind: "habit-create",
    name: "Walking",
    schedule: "custom",
    days: "1,2,3",
    reminderTime: "07:00",
  });
  const revision = resolveExplicitAppAction(
    "Actually, weekends only.",
    reminder?.draft,
    now,
  );
  assert.deepEqual(revision?.action, {
    id: revision?.action?.id,
    kind: "habit-create",
    name: "Walking",
    schedule: "weekends",
    reminderTime: "07:00",
  });
  assert.notEqual(revision?.action?.id, reminder?.action?.id);
  assert.equal(
    resolveExplicitAppAction(
      'Tell me if "Yes" means approval',
      revision?.draft,
      now,
    ),
    undefined,
  );
  const cancel = resolveExplicitAppAction("Cancel that", revision?.draft, now);
  assert.equal(cancel?.action?.kind, "cancel");
  assert.equal(resolveExplicitAppAction("Yes", cancel?.draft, now), undefined);
});

test("exact reminder, practice and Journey commands retain the requested time, duration and period", () => {
  for (const [text, expected] of [
    [
      "Remind me to meditate every day at 8 PM.",
      {
        kind: "reminder-create",
        title: "Meditate",
        time: "20:00",
        repeat: "daily",
      },
    ],
    [
      "Set a daily check-in reminder for 9 AM.",
      {
        kind: "reminder-create",
        title: "Check-in",
        time: "09:00",
        repeat: "daily",
        type: "checkin",
      },
    ],
    [
      "Start a three-minute breathing exercise.",
      { kind: "practice-start", practice: "breathing", minutes: 3 },
    ],
    [
      "What did I do yesterday?",
      { kind: "journey-summary", metric: "activities", period: "yesterday" },
    ],
  ] as const) {
    const action = resolveExplicitAppAction(text)?.action;
    assert.deepEqual(action, { id: action?.id, ...expected }, text);
  }
});

test("the app action allowlist accepts each supported command family and preserves user arguments", () => {
  const commands = [
    ["Take me to my journal.", { kind: "navigate", destination: "journal" }],
    [
      "Create a new journal entry.",
      { kind: "navigate", destination: "journal-editor" },
    ],
    [
      "Could you open my Habit Dashboard?",
      { kind: "navigate", destination: "habits" },
    ],
    [
      "Show my habit insights.",
      { kind: "navigate", destination: "habit-insights" },
    ],
    [
      "Open the Ambient Sound Mixer.",
      { kind: "navigate", destination: "ambient-mixer" },
    ],
    ["Switch to dark mode.", { kind: "theme", mode: "dark" }],
    [
      "Create a habit to drink water every day.",
      { kind: "habit-create", name: "Drink water", schedule: "daily" },
    ],
    [
      "Mark my evening walk as complete.",
      { kind: "habit-complete", name: "Evening walk" },
    ],
    [
      "Remind me to meditate at eight PM.",
      {
        kind: "reminder-create",
        title: "Meditate",
        time: "20:00",
        repeat: "daily",
      },
    ],
    [
      "Could you, please, remind me to meditate at eight thirty-five p.m.?",
      {
        kind: "reminder-create",
        title: "Meditate",
        time: "20:35",
        repeat: "daily",
      },
    ],
    [
      "Remind me to stretch on weekends at 12:00 AM.",
      {
        kind: "reminder-create",
        title: "Stretch",
        time: "00:00",
        repeat: "weekends",
      },
    ],
    [
      "Schedule a reminder to walk weekdays at 12 PM.",
      {
        kind: "reminder-create",
        title: "Walk",
        time: "12:00",
        repeat: "weekdays",
      },
    ],
    [
      "Start a five-minute breathing exercise.",
      { kind: "practice-start", practice: "breathing", minutes: 5 },
    ],
    [
      "Start a 15-minute grounding practice.",
      { kind: "practice-start", practice: "grounding", minutes: 15 },
    ],
    ["Show my weekly progress.", { kind: "progress", period: "week" }],
    [
      "How many habits did I complete this week?",
      { kind: "habit-progress", period: "week" },
    ],
    [
      "Find the entry I wrote yesterday.",
      { kind: "journal-search", when: "yesterday" },
    ],
    ["Cancel that.", { kind: "cancel" }],
  ] as const;
  for (const [request, action] of commands)
    assert.deepEqual(
      validateAppAction(action, request, id),
      { ...action, id },
      request,
    );
});

test("model arguments cannot add permissions, invent targets, or change what the user requested", () => {
  const journal = { kind: "navigate", destination: "journal" };
  const reminder = {
    kind: "reminder-create",
    title: "Meditate",
    time: "20:00",
    repeat: "daily",
  };
  const unsafe = [
    ["Open my journal", { ...journal, destination: "http://example.com" }],
    ["Open my journal", { ...journal, accountId: "another-user" }],
    ["Open my journal", { ...journal, id }],
    ["Open my journal", { kind: "navigate", destination: "support" }],
    ["Open my journal", { kind: "delete", target: "all-data" }],
    ["I read the words 'open my journal'", journal],
    ['Open the text "open my journal"', journal],
    ["Show me how to open my journal", journal],
    ["Open my habit log", { kind: "habit-complete", name: "habit" }],
    [
      "Create a habit to drink water every day",
      { kind: "habit-create", name: "Go running", schedule: "daily" },
    ],
    ["Remind me to meditate at 8 PM", { ...reminder, time: "08:00" }],
    ["Remind me to meditate at 8 PM on Monday", reminder],
    ["Remind me to meditate at 8 PM tomorrow", reminder],
    ["Remind me to meditate", reminder],
    ["Open the reminder to meditate at 8 PM", reminder],
    [
      "Start a 30-minute breathing exercise",
      { kind: "practice-start", practice: "breathing", minutes: 5 },
    ],
    ["Show my progress last week", { kind: "progress", period: "week" }],
    [
      "Find the entry I wrote yesterday",
      { kind: "journal-search", when: "today" },
    ],
    ["Open my journal", { kind: "cancel" }],
  ] as const;
  for (const [request, action] of unsafe)
    assert.equal(validateAppAction(action, request, id), undefined, request);
  assert.equal(
    readAppAction({ ...journal, id: "provider-supplied" }),
    undefined,
  );
  assert.equal(readAppAction({ ...reminder, id, time: "24:00" }), undefined);
});
