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

type GoogleFlowStage = "browser" | "return" | "finish";

function googleFlowError(stage: GoogleFlowStage, message: string) {
  return Object.assign(new Error(message), { stage });
}

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
  let result: Awaited<ReturnType<GoogleFlowServices["open"]>>;
  try {
    result = await services.open(url, GOOGLE_RETURN_URL);
  } catch {
    if (signal.aborted) return "cancelled";
    throw googleFlowError("browser", "Google’s sign-in window could not open.");
  }
  if (signal.aborted || result?.type === "cancel" || result?.type === "dismiss")
    return "cancelled";
  // Native browsers can serialize the root path or an empty fragment.
  const returnedUrl = result?.url;
  const match =
    typeof returnedUrl === "string" &&
    /^solace:\/\/google-auth\/?\?handoff=([A-Za-z0-9_-]{43})#?$/.exec(
      returnedUrl,
    );
  if (result?.type !== "success" || !match || match[0] !== returnedUrl) {
    throw googleFlowError(
      "return",
      "Google sign-in could not return to Solace.",
    );
  }
  try {
    await services.complete({ id, verifier, handoff: match[1] }, signal);
  } catch (error) {
    if (signal.aborted) return "cancelled";
    const details = error as {
      code?: unknown;
      status?: unknown;
      connection?: boolean;
    } | null;
    if (details?.connection === true) throw error;
    throw Object.assign(
      googleFlowError("finish", "Google sign-in could not finish."),
      { code: details?.code, status: details?.status },
    );
  }
  return signal.aborted ? "cancelled" : "complete";
}

export function googleAuthMessage(error: unknown, linking = false) {
  const details = error as {
    code?: unknown;
    status?: unknown;
    connection?: unknown;
    stage?: unknown;
  } | null;
  const code = details?.code;
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
  const status = details?.status;
  if (status === 429)
    return "There have been too many attempts. Wait a moment and try again.";
  if (linking && status === 401)
    return "Sign in to your Solace account again before linking Google.";
  if (details?.connection === true)
    return "Couldn’t reach Solace. Check your connection and try again.";
  switch (details?.stage) {
    case "browser":
      return "Google’s sign-in window couldn’t open. Try again.";
    case "return":
      return "Google returned without a valid sign-in confirmation. Start again to continue.";
    case "finish":
      return linking
        ? "Google returned to Solace, but linking couldn’t finish. Start again to continue."
        : "Google returned to Solace, but sign-in couldn’t finish. Start again or continue with email.";
  }
  return linking
    ? "Google couldn’t be linked. Please try again."
    : "Google sign-in couldn’t finish. Try again or continue with email.";
}
