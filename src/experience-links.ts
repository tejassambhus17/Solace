import { routes, type SolaceMode } from "./routes";
import { isTechniqueId, type TechniqueId } from "./techniques";

type ExperienceDestination =
  | { mode: SolaceMode }
  | { route: typeof routes.techniques; techniqueId?: TechniqueId };

export function experienceDestination(
  url: string | null | undefined,
): ExperienceDestination | null {
  if (/^solace:\/\/companion\/?$/.test(url ?? ""))
    return { mode: "companion" } as const;
  if (/^solace:\/\/journal\/?$/.test(url ?? ""))
    return { mode: "journal" } as const;
  const match = /^solace:\/\/techniques(?:\/([a-z-]+))?\/?$/.exec(url ?? "");
  if (!match) return null;
  const techniqueId = match[1];
  if (techniqueId !== undefined && !isTechniqueId(techniqueId)) return null;
  return {
    route: routes.techniques,
    techniqueId,
  };
}
