export const GOOGLE_RETURN_URL = "solace://google-auth";

export type GoogleFlowStart = { id: string; url: string };
export type GoogleFlowProof = { id: string; verifier: string; handoff: string };

type GoogleFlowServices = {
  apiOrigin: string;
  randomBytes: (count: number) => Promise<Uint8Array>;
  digestBase64: (value: string) => Promise<string>;
  start: (challenge: string, signal: AbortSignal) => Promise<GoogleFlowStart>;
  open: (
    url: string,
    redirect: string,
  ) => Promise<{ type: string; url?: string }>;
  complete: (proof: GoogleFlowProof, signal: AbortSignal) => Promise<unknown>;
};

/** The app proof stays in memory. The browser supplies a separate one-time code. */
export async function runGoogleFlow(
  services: GoogleFlowServices,
  signal: AbortSignal,
): Promise<"complete" | "cancelled"> {
  const bytes = await services.randomBytes(32);
  if (signal.aborted) return "cancelled";
  const verifier = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const challenge = (await services.digestBase64(verifier))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (signal.aborted) return "cancelled";
  const { id, url } = await services.start(challenge, signal);
  if (signal.aborted) return "cancelled";
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(id) ||
    !services.apiOrigin.startsWith("https://") ||
    url !== `${services.apiOrigin}/api/auth/google/browser/${id}`
  ) {
    throw new Error("Google sign-in could not start.");
  }
  const result = await services.open(url, GOOGLE_RETURN_URL);
  if (signal.aborted || result.type === "cancel" || result.type === "dismiss")
    return "cancelled";
  const handoff = /^solace:\/\/google-auth\?handoff=([A-Za-z0-9_-]{43})$/.exec(
    result.url ?? "",
  )?.[1];
  if (result.type !== "success" || !handoff) {
    throw new Error("Google sign-in could not return to Solace.");
  }
  await services.complete({ id, verifier, handoff }, signal);
  return signal.aborted ? "cancelled" : "complete";
}

export function googleAuthMessage(error: unknown, linking = false) {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case "GOOGLE_CANCELLED":
      return linking
        ? "Google linking was cancelled."
        : "Google sign-in was cancelled.";
    case "GOOGLE_EMAIL_IN_USE":
      return "Sign in to your existing Solace account, then link Google in Account settings.";
    case "GOOGLE_ALREADY_LINKED":
      return "That Google or Solace account already has a different link.";
    case "GOOGLE_UNAVAILABLE":
      return "Google sign-in is currently unavailable. Please try again later.";
    case "GOOGLE_FLOW_INVALID":
    case "GOOGLE_PENDING":
      return "This Google attempt couldn’t finish. Start again to continue.";
    case "GOOGLE_PROVIDER_UNAVAILABLE":
      return "Couldn’t reach Google. Please try again.";
    case "GOOGLE_IDENTITY_INVALID":
      return "Couldn’t verify this Google account. Please try again.";
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429)
    return "There have been too many attempts. Wait a moment and try again.";
  if (linking && status === 401)
    return "Sign in to your Solace account again before linking Google.";
  if ((error as { connection?: unknown } | null)?.connection === true)
    return "Couldn’t reach Solace. Check your connection and try again.";
  return linking
    ? "Google couldn’t be linked. Please try again."
    : "Google sign-in couldn’t finish. Try again or continue with email.";
}
