import "dotenv/config";
import { Store } from "./database.js";
import { createApp } from "./app.js";
import { parseTrustProxyHops } from "./config.js";
const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);
const store = await Store.open(
  process.env.DATABASE_PATH ?? "./data/solace.sqlite",
);
const mode = process.env.AI_MODE ?? "auto";
if (!["auto", "live", "offline"].includes(mode))
  throw new Error("AI_MODE must be auto, live, or offline.");
const app = createApp({
  store,
  trustProxyHops,
  ai: {
    mode: mode as "auto" | "live" | "offline",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",")
    .map((x) => x.trim())
    .filter(Boolean),
});
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, process.env.HOST ?? "0.0.0.0", () =>
  console.log(
    `Solace API ready on port ${port}. AI mode: ${mode === "offline" || !process.env.OPENAI_API_KEY ? "offline companion" : "live provider"}.`,
  ),
);
const close = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
