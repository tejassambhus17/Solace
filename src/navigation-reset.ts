import { createContext, useContext, useLayoutEffect } from "react";
import { useApp } from "./store";

export type ExitReason = "back" | "tab";
export type ExitGuard = "dirty" | "saving";

export const TabResetGuardContext = createContext<{
  register: (routeKey: number, guard: ExitGuard) => () => void;
  leave: (action: () => void, reason: ExitReason) => void;
} | null>(null);

export function useTabResetGuard(dirty: boolean, guard: ExitGuard = "dirty") {
  const { routeKey } = useApp();
  const register = useContext(TabResetGuardContext)?.register;
  useLayoutEffect(() => {
    if (dirty) return register?.(routeKey, guard);
  }, [dirty, guard, register, routeKey]);
}

// Save handlers can still use app.back directly. Only user-driven Back
// requests should pass through the unsaved-changes confirmation.
export function useGuardedBack(back?: () => void) {
  const navigation = useContext(TabResetGuardContext);
  return () => {
    if (!back) return;
    if (navigation) navigation.leave(back, "back");
    else back();
  };
}
