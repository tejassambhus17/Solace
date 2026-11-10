export type AssessmentId = "mood" | "anxiety" | "self-love";
export type AssessmentDefinition = {
  id: AssessmentId;
  title: string;
  description: string;
  icon: string;
  questions: string[];
};

export const ASSESSMENTS: AssessmentDefinition[] = [
  {
    id: "mood",
    title: "Mood vibes",
    icon: "leaf-outline",
    description: "A simple reflection to notice how you have been feeling.",
    questions: [
      "Over the past two weeks, how often have you felt low or discouraged?",
      "How often has it felt difficult to enjoy things you usually like?",
      "How often have you felt low on energy?",
      "How often has it felt difficult to get through your usual day?",
    ],
  },
  {
    id: "anxiety",
    title: "Anxiety check",
    icon: "water-outline",
    description: "Notice worry, tension, and what might help you feel at ease.",
    questions: [
      "Over the past two weeks, how often have you felt overwhelmed?",
      "How often have you found it difficult to set worries aside?",
      "How often have you felt tense or on edge?",
      "How often has worry got in the way of things you want to do?",
    ],
  },
  {
    id: "self-love",
    title: "Self-love reflection",
    icon: "heart-outline",
    description: "Make room for self-compassion, strengths, and small wins.",
    questions: [
      "Over the past two weeks, how often have you been hard on yourself?",
      "How often have you compared yourself unfavourably with others?",
      "How often has it felt difficult to acknowledge your efforts?",
      "How often have you put your own needs aside when you needed care?",
    ],
  },
];

export const ASSESSMENT_OPTIONS = [
  "Not at all",
  "A little",
  "Quite a bit",
  "Very often",
];

export function assessmentSummary(id: AssessmentId, answers: number[]) {
  const score = answers.reduce((sum, value) => sum + value, 0);
  if (id === "self-love")
    return {
      score,
      title: "A little kindness, for you",
      text:
        score >= 6
          ? "Your answers suggest you have been asking a lot of yourself. You can make room for your own needs, one small step at a time."
          : "Your answers suggest there has been some room for kindness toward yourself. Notice what supports that, without expecting every day to feel the same.",
    };
  if (score >= 8)
    return {
      score,
      title: "You deserve some support",
      text: "Your answers suggest things have been feeling demanding lately. A small pause may be welcome, and talking with someone you trust or a qualified professional is an option too.",
    };
  if (score >= 4)
    return {
      score,
      title: "Make room for a gentle pause",
      text: "Your answers suggest you have had a mix of feelings lately. Notice what you need today and choose one manageable next step.",
    };
  return {
    score,
    title: "Notice what is supporting you",
    text: "Your answers suggest things have felt relatively manageable lately. You can keep making room for the small things that help, and check in again whenever you wish.",
  };
}

export type ResourceStep = {
  title: string;
  text: string;
  action?: "breathing" | "reflection" | "checkin";
};
export type ResourceGuide = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  steps: ResourceStep[];
};
export const RESOURCE_GUIDES: ResourceGuide[] = [
  {
    id: "mindfulness",
    title: "Mindfulness",
    subtitle: "Simple practices to feel more present.",
    description:
      "A few ways to notice this moment, without needing to change it.",
    icon: "leaf-outline",
    steps: [
      {
        title: "Arrive here",
        text: "Notice where your body meets the chair or floor. Let your shoulders settle in a comfortable position.",
      },
      {
        title: "Notice your breath",
        text: "Follow a few natural breaths. If focusing on breathing is uncomfortable, notice sounds around you instead.",
        action: "breathing",
      },
      {
        title: "Use your senses",
        text: "Name three things you can see, two things you can hear, and one sensation you can feel.",
      },
      {
        title: "Return with kindness",
        text: "Your attention may wander. When you notice, gently return to one thing in front of you.",
      },
    ],
  },
  {
    id: "anxiety",
    title: "Anxiety toolkit",
    subtitle: "Gentle, practical ways to feel more grounded.",
    description:
      "Choose a small practice when you feel worried or overwhelmed. You can stop or switch at any point.",
    icon: "water-outline",
    steps: [
      {
        title: "Breathe & reset",
        text: "Try a short, unhurried breathing practice. Keep the breath comfortable; there is no need to force or hold it.",
        action: "breathing",
      },
      {
        title: "Grounding check-in",
        text: "Notice five things you can see, four things you can feel, and three things you can hear. Skip any part that does not feel helpful.",
      },
      {
        title: "Worry pause",
        text: "Write down what is worrying you. Ask: is there one small action I can take now, or can this wait until later?",
        action: "reflection",
      },
      {
        title: "Soothe your senses",
        text: "Choose a familiar sound, a comfortable texture, or a quiet place. Notice whether it offers a little ease.",
      },
    ],
  },
  {
    id: "low-mood",
    title: "Low mood",
    subtitle: "Supportive ideas for a day that feels heavy.",
    description:
      "Small actions can make a day feel more manageable. You do not have to complete everything here.",
    icon: "cloud-outline",
    steps: [
      {
        title: "Name this moment",
        text: "Try a quick check-in. You do not need to explain or justify how you feel.",
        action: "checkin",
      },
      {
        title: "Care for one basic need",
        text: "Consider a glass of water, something to eat, or a comfortable place to rest. Choose what is accessible to you.",
      },
      {
        title: "Choose a small change",
        text: "If it feels possible, stretch, step outside, or open a curtain. A small change is enough.",
      },
      {
        title: "Connect with someone",
        text: "You might send a simple message to someone you trust: “It is a difficult day. Could we talk?”",
      },
    ],
  },
  {
    id: "self-esteem",
    title: "Self-esteem",
    subtitle: "Build a kinder, more supportive inner voice.",
    description:
      "You can acknowledge a difficult feeling without turning it into a judgment about yourself.",
    icon: "heart-outline",
    steps: [
      {
        title: "Notice the inner critic",
        text: "Write down one harsh thought as something you are noticing, rather than a fact about who you are.",
        action: "reflection",
      },
      {
        title: "Try a kinder response",
        text: "Imagine what you would say to a friend in the same situation. Try offering yourself those words.",
      },
      {
        title: "Acknowledge an effort",
        text: "Name something you tried today, including something small. Effort can matter even when an outcome is uncertain.",
      },
      {
        title: "Make room for a need",
        text: "Choose one manageable act of care, such as taking a break or asking for help.",
      },
    ],
  },
  {
    id: "sleep",
    title: "Sleep wind-down",
    subtitle: "Calming tools to help you unwind and rest.",
    description:
      "A gentle, four-step guide for settling toward rest. There is no need to make sleep happen on command.",
    icon: "moon-outline",
    steps: [
      {
        title: "Breathe",
        text: "Take a few slow, comfortable breaths. Let the pace be natural, and stop if you feel uncomfortable.",
        action: "breathing",
      },
      {
        title: "Let go",
        text: "Write down a thought or task you can return to tomorrow. You do not need to solve it tonight.",
        action: "reflection",
      },
      {
        title: "Relax",
        text: "Notice your jaw, shoulders, and hands. Invite each area to soften without forcing it.",
      },
      {
        title: "Settle",
        text: "If it suits you, lower the lights and put stimulating tasks aside. Choose a quiet, familiar activity.",
      },
    ],
  },
];

export const AFFIRMATIONS = [
  "I can take things one gentle step at a time.",
  "My feelings can be here without defining who I am.",
  "I can ask for support when I need it.",
  "A small act of care is enough for this moment.",
  "I do not have to earn a moment of rest.",
  "I can notice my effort with kindness.",
  "I am allowed to begin again.",
];

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function todayAffirmation(date = new Date()) {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  return AFFIRMATIONS[day % AFFIRMATIONS.length];
}

type ProgressRecord = Record<string, any>;
export function recordDay(record: ProgressRecord): string | undefined {
  // The day selected on the device takes precedence over the UTC storage timestamp.
  if (
    typeof record.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.day)
  ) {
    const [year, month, day] = record.day.split("-").map(Number);
    const candidate = new Date(year, month - 1, day, 12);
    if (localDay(candidate) === record.day) return record.day;
  }
  const date = new Date(record.createdAt);
  return Number.isNaN(date.valueOf()) ? undefined : localDay(date);
}

export function participationProgress(
  data: {
    checkins?: ProgressRecord[];
    sessions?: ProgressRecord[];
    reflections?: ProgressRecord[];
    assessments?: ProgressRecord[];
  },
  now = new Date(),
) {
  const today = localDay(now);
  const visible = (record: ProgressRecord) => {
    const day = recordDay(record);
    return !!day && day <= today;
  };
  const checkins = (data.checkins || []).filter(visible);
  const days = new Set(
    checkins.map(recordDay).filter((day): day is string => !!day),
  );
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const startDay = localDay(start);
  const checkinsThisWeek = checkins.filter((record) => {
    const day = recordDay(record)!;
    return day >= startDay && day <= today;
  }).length;
  const cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const completedMoments = (data.sessions || []).filter(
    (record) => record.completed === true && visible(record),
  ).length;
  const xp =
    days.size * 10 +
    completedMoments * 20 +
    (data.reflections || []).filter(visible).length * 10 +
    (data.assessments || []).filter(visible).length * 10;
  return {
    streak,
    checkedDays: days.size,
    checkinsThisWeek,
    completedMoments,
    xp,
    level: Math.floor(xp / 100) + 1,
    xpInLevel: xp % 100,
    xpToNextLevel: 100 - (xp % 100),
  };
}
