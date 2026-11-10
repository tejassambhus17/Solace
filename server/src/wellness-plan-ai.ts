import { z } from "zod";
import { provider, structuredOutput, type AIConfig } from "./generation.js";
import {
  buildWellnessTasks,
  planFocuses,
  planMinutes,
  type PlanTask,
} from "./wellness-plans.js";

export const planPreviewInput = z
  .object({
    goal: z.enum(planFocuses),
    preferredFocuses: z
      .array(z.enum(planFocuses))
      .min(1)
      .max(planFocuses.length),
    dailyMinutes: z.literal(planMinutes),
  })
  .strict()
  .refine(
    ({ preferredFocuses }) =>
      new Set(preferredFocuses).size === preferredFocuses.length,
    "Choose each practice type only once.",
  );

export type PlanPreviewInput = z.infer<typeof planPreviewInput>;
export type PlanPreview = { provider: "live" | "offline"; tasks: PlanTask[] };

export async function generatePlanPreview(
  config: AIConfig,
  input: PlanPreviewInput,
  options?: { signal?: AbortSignal; canRetry?: () => boolean },
): Promise<PlanPreview> {
  const { goal, preferredFocuses, dailyMinutes } = input;
  if (provider(config) === "offline")
    return {
      provider: "offline",
      tasks: buildWellnessTasks(goal, preferredFocuses, dailyMinutes),
    };

  const schema = z
    .object({ focuses: z.array(z.enum(preferredFocuses)).length(3) })
    .strict();
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const output = await structuredOutput(
    config,
    "solace_wellness_plan",
    jsonSchema,
    "Choose a gentle three-day wellness routine using only the provided preferredFocuses. Return exactly three focus choices in day order. Follow the selected goal where it fits, vary the days when helpful, and repeat a choice if needed. The practice durations, instructions and titles are selected by Solace. Do not return any prose, route, or medical advice.",
    input,
    { maxTokens: 240, ...options },
  );
  const parsed = schema.safeParse(output);
  if (!parsed.success) throw new Error("AI_INVALID_RESPONSE");

  return {
    provider: "live",
    tasks: parsed.data.focuses.map((focus, index) => ({
      ...buildWellnessTasks(focus, [focus], dailyMinutes)[0],
      id: `day-${index + 1}`,
    })),
  };
}
