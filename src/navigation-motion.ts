export type TabFrame = { x: number; width: number };
export type TabStop = { name: string; center: number };
export type TabSelectionIntent = "switch" | "reselect";

export function measuredTabStops(
  names: readonly string[],
  frames: ReadonlyMap<string, TabFrame>,
  rowWidth: number,
  diameter: number,
): TabStop[] {
  if (rowWidth < diameter) return [];
  const stops: TabStop[] = [];
  for (const name of names) {
    const frame = frames.get(name);
    if (
      !frame ||
      frame.width <= 0 ||
      frame.x < 0 ||
      frame.x + frame.width > rowWidth + 1
    )
      return [];
    stops.push({ name, center: frame.x + frame.width / 2 });
  }
  stops.sort((a, b) => a.center - b.center);
  if (stops.some((stop, i) => i > 0 && stop.center - stops[i - 1].center < 1))
    return [];
  return stops;
}

export function dragIntent(dx: number, dy: number) {
  if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.25)
    return "horizontal";
  if (Math.abs(dy) >= 8) return "vertical";
  return "pending";
}

export function clampTabCenter(x: number, stops: readonly TabStop[]) {
  return Math.max(stops[0].center, Math.min(stops[stops.length - 1].center, x));
}

export function nearestTab(
  x: number,
  stops: readonly TabStop[],
  current: string,
) {
  return stops.reduce((nearest, stop) => {
    const distance = Math.abs(stop.center - x);
    const best = Math.abs(nearest.center - x);
    return distance < best || (distance === best && stop.name === current)
      ? stop
      : nearest;
  }, stops[0]);
}

export function edgeBackStart(x: number, width: number, rtl: boolean) {
  const fromEdge = rtl ? width - x : x;
  return fromEdge >= 0 && fromEdge <= 24;
}

export function edgeBackIntent(dx: number, dy: number, rtl: boolean) {
  return (rtl ? -dx : dx) >= 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function edgeBackComplete(
  dx: number,
  dy: number,
  width: number,
  rtl: boolean,
) {
  return (
    edgeBackIntent(dx, dy, rtl) && Math.abs(dx) >= Math.min(72, width * 0.2)
  );
}
