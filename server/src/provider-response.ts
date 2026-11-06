const PROVIDER_MAX_RESPONSE_BYTES = 256 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readProviderJson(response: Response) {
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error(`AI_PROVIDER_${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI_INVALID_RESPONSE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PROVIDER_MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new Error("AI_INVALID_RESPONSE");
      }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(
      Buffer.concat(chunks, size).toString("utf8"),
    );
    if (!isObject(body)) throw new Error("AI_INVALID_RESPONSE");
    return body;
  } catch {
    throw new Error("AI_INVALID_RESPONSE");
  } finally {
    reader.releaseLock();
  }
}

export async function readProviderText(response: Response) {
  const body = await readProviderJson(response);
  if (body.status !== undefined && body.status !== "completed")
    throw new Error("AI_INCOMPLETE_RESPONSE");
  const content = Array.isArray(body.output)
    ? body.output
        .flatMap((item: unknown) =>
          isObject(item) && Array.isArray(item.content) ? item.content : [],
        )
        .filter(isObject)
    : [];
  if (content.some((item) => item.type === "refusal"))
    throw new Error("AI_REFUSED");
  return typeof body.output_text === "string"
    ? body.output_text
    : content
        .filter(
          (item) =>
            item.type === "output_text" && typeof item.text === "string",
        )
        .map((item) => item.text)
        .join("\n");
}

export async function readGeminiText(response: Response) {
  const body = await readProviderJson(response);
  if (isObject(body.promptFeedback) && body.promptFeedback.blockReason)
    throw new Error("AI_REFUSED");
  const candidate = Array.isArray(body.candidates) ? body.candidates[0] : null;
  if (!isObject(candidate)) throw new Error("AI_EMPTY_RESPONSE");
  if (
    typeof candidate.finishReason === "string" &&
    [
      "SAFETY",
      "BLOCKLIST",
      "PROHIBITED_CONTENT",
      "SPII",
      "RECITATION",
      "MODEL_ARMOR",
    ].includes(candidate.finishReason)
  )
    throw new Error("AI_REFUSED");
  if (candidate.finishReason !== "STOP")
    throw new Error("AI_INCOMPLETE_RESPONSE");
  const content = candidate.content;
  if (!isObject(content) || !Array.isArray(content.parts))
    throw new Error("AI_INVALID_RESPONSE");
  return content.parts
    .filter(isObject)
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}
