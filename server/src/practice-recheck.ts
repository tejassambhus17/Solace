export const emotionalRecheckResponses = [
  "more-settled",
  "about-the-same",
  "less-settled",
] as const;

export type EmotionalRecheckResponse =
  (typeof emotionalRecheckResponses)[number];

export const emotionalRecheckLabels: Record<EmotionalRecheckResponse, string> =
  {
    "more-settled": "More settled",
    "about-the-same": "About the same",
    "less-settled": "Less settled",
  };
