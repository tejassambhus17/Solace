/** Native libraries are compiled into a binary. An older development client
 * must not evaluate a newly added native import before it can show the app. */
export function nativeModulesAvailable(
  platform: string,
  lookup: (name: string) => unknown,
  names: string[],
) {
  if (platform === "web") return true;
  return names.every((name) => {
    try {
      return !!lookup(name);
    } catch {
      return false;
    }
  });
}
