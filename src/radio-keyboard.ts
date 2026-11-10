import type { KeyboardEvent } from "react";
import { Platform, type KeyDownEvent } from "react-native";

function onRadioKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const option = event.currentTarget;
  if (option.getAttribute("aria-disabled") === "true") return;
  if (event.key === " ") {
    event.preventDefault();
    if (!event.repeat) option.click();
    return;
  }
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ].includes(event.key)
  )
    return;
  const group = option.closest('[role="radiogroup"]');
  if (!group) return;
  const options = Array.from(
    group.querySelectorAll<HTMLElement>(
      '[role="radio"]:not([aria-disabled="true"])',
    ),
  ).filter((item) => item.closest('[role="radiogroup"]') === group);
  const index = options.indexOf(option);
  if (index < 0) return;
  const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (index + step + options.length) % options.length;
  event.preventDefault();
  options[next].focus();
  if (next !== index) options[next].click();
}

export function webRadioProps(selected: boolean) {
  return Platform.OS === "web"
    ? {
        tabIndex: selected ? (0 as const) : (-1 as const),
        // RN Web passes a React DOM event through the native Pressable prop.
        onKeyDown: (event: KeyDownEvent) =>
          onRadioKeyDown(event as unknown as KeyboardEvent<HTMLElement>),
      }
    : {};
}
