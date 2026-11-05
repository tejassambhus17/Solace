export type ApiConfigurationOptions = {
  configuredUrl?: string;
  platform: string;
  development: boolean;
  webHostname?: string;
};

export type ApiConfiguration = {
  baseUrl: string | null;
  origin: string | null;
  error: string | null;
  development: boolean;
  platform: string;
  source: "environment" | "development-default" | "unconfigured";
};

const DEVELOPMENT_PORT = 3001;
const malformedMessage =
  "Solace's API address is invalid. Set EXPO_PUBLIC_API_URL to an http:// or https:// server URL without credentials, query parameters, or fragments, then restart Expo.";
const releaseMessage =
  "This Solace build needs a configured HTTPS API. Set EXPO_PUBLIC_API_URL to the deployed server address and rebuild the app.";

function isLocalOnly(hostname: string) {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    /^127(?:\.\d{1,3}){3}$/.test(host) ||
    host === "::" ||
    host === "::1" ||
    host.startsWith("::ffff:7f") ||
    host === "10.0.2.2" ||
    host === "10.0.3.2"
  );
}

/** Public connection configuration only. This module never reads provider keys.
 * Development defaults describe the emulator host; installed release builds
 * must opt into a real HTTPS endpoint instead of silently using localhost. */
export function resolveApiConfiguration(
  options: ApiConfigurationOptions,
): ApiConfiguration {
  const issue = (error: string): ApiConfiguration => ({
    baseUrl: null,
    origin: null,
    error,
    development: options.development,
    platform: options.platform,
    source: "unconfigured",
  });
  let value = (options.configuredUrl || "").trim();
  let source: ApiConfiguration["source"] = "environment";
  if (!value) {
    if (!options.development) return issue(releaseMessage);
    source = "development-default";
    if (options.platform === "android")
      value = `http://10.0.2.2:${DEVELOPMENT_PORT}`;
    else if (options.platform === "ios")
      value = `http://127.0.0.1:${DEVELOPMENT_PORT}`;
    else if (options.platform === "web") {
      const hostname = (options.webHostname || "127.0.0.1").trim();
      // location.hostname excludes ports and includes IPv6 brackets in some
      // runtimes. Keep the address intact rather than splitting it on ':'.
      const host = hostname.replace(/^\[|\]$/g, "");
      if (!host || /[\s/?#@\\]/.test(host)) return issue(malformedMessage);
      if (
        (hostname.includes("[") || hostname.includes("]")) &&
        !(
          hostname.startsWith("[") &&
          hostname.endsWith("]") &&
          host.includes(":")
        )
      )
        return issue(malformedMessage);
      value = `http://${host.includes(":") ? `[${host}]` : host}:${DEVELOPMENT_PORT}`;
    } else {
      return issue(
        "Set EXPO_PUBLIC_API_URL to the Solace server address for this device, then restart Expo.",
      );
    }
  }
  // WHATWG parsers repair some malformed input. Reject those forms before
  // parsing so a typo cannot silently change the server receiving user data.
  if (!/^https?:\/\/[^/]+/i.test(value) || /[\s\\?#]/.test(value))
    return issue(malformedMessage);
  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      /^https?:\/\/[^/]*@/i.test(value)
    )
      return issue(malformedMessage);
    if (
      !options.development &&
      (parsed.protocol !== "https:" || isLocalOnly(parsed.hostname))
    )
      return issue(releaseMessage);
    return {
      baseUrl: parsed.toString().replace(/\/+$/, ""),
      origin: parsed.origin,
      error: null,
      development: options.development,
      platform: options.platform,
      source,
    };
  } catch {
    return issue(malformedMessage);
  }
}

/** Describe a failed connection without exposing a record path, token, or body. */
export function apiConnectionError(
  configuration: ApiConfiguration,
  timedOut: boolean,
): string {
  if (!configuration.development) {
    return timedOut
      ? "Solace is taking too long to respond. Please try again."
      : "Unable to connect to Solace. Check your connection and try again.";
  }
  const problem = timedOut
    ? `Solace at ${configuration.origin} is taking too long to respond.`
    : `Unable to connect to Solace at ${configuration.origin}.`;
  const deviceHint =
    configuration.platform === "ios"
      ? "The iOS simulator needs the API running on the same Mac; a physical iPhone needs the Mac's LAN address."
      : configuration.platform === "android"
        ? "The Android emulator uses its host address; a physical phone needs the computer's LAN address."
        : "The web preview and API must use reachable addresses.";
  return `${problem} Start the backend with npm run server and verify /api/health. ${deviceHint} Restart Expo after changing EXPO_PUBLIC_API_URL.`;
}
