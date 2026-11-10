export function openAIEvents(...events: Record<string, unknown>[]) {
  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

export function openAIResponse(text: string, stream = false) {
  const response = {
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
  };
  return stream
    ? openAIEvents({ type: "response.completed", response })
    : Response.json(response);
}
