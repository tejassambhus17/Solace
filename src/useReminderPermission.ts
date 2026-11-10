import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { readReminderDelivery, type ReminderPermission } from "./notifications";

export function useReminderDelivery(active: boolean, userId: string) {
  const [delivery, setDelivery] = useState<{
    permission: ReminderPermission;
    scheduled: Set<string>;
  }>({
    permission: Platform.OS === "web" ? "web-preview" : "checking",
    scheduled: new Set(),
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    let cancelled = false;
    let request = 0;
    const check = () => {
      const current = ++request;
      void readReminderDelivery(userId)
        .catch(() => ({
          permission: "unknown" as const,
          scheduled: new Set<string>(),
        }))
        .then((value) => {
          if (!cancelled && current === request) setDelivery(value);
        });
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [active, revision, userId]);

  return [delivery, () => setRevision((value) => value + 1)] as const;
}
