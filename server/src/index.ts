import { config as loadEnvironment } from "dotenv";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Store } from "./database.js";
import { createApp } from "./app.js";
import { readServerConfig } from "./config.js";
import { provider } from "./ai.js";
import { recoveryMailerFromEnv } from "./password-recovery.js";

async function start() {
  // Source and compiled entry points both live one directory below server/.
  // Never accidentally load the Expo/public .env from the caller's directory.
  const serverRoot = fileURLToPath(new URL("../", import.meta.url));
  loadEnvironment({ path: resolve(serverRoot, ".env") });
  const configuration = readServerConfig(process.env, serverRoot);
  let application: ReturnType<typeof createApp> | undefined;
  const server = createServer((request, response) => {
    if (application) {
      application(request, response);
      return;
    }
    response.writeHead(503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": "1",
      Connection: "close",
    });
    response.end(
      JSON.stringify({
        ok: false,
        error: "Solace is starting. Please try again shortly.",
        code: "STARTING",
      }),
    );
  });
  // Reserve the listener before Store.open: opening/persisting SQL.js before a
  // failed bind could overwrite a database still owned by the running API.
  await new Promise<void>((resolveListening, reject) => {
    const failed = (error: NodeJS.ErrnoException) =>
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `Port ${configuration.port} is already in use. Stop the other API process or set PORT in server/.env.`
            : `Could not listen (${error.code || "unknown error"}). Check HOST and PORT in server/.env.`,
        ),
      );
    server.once("error", failed);
    server.listen(configuration.port, configuration.host, () => {
      server.removeListener("error", failed);
      resolveListening();
    });
  });
  const closeListener = () =>
    new Promise<void>((resolveClosed) => {
      server.close(() => resolveClosed());
      server.closeIdleConnections();
    });
  let store: Store | undefined;
  try {
    store = await Store.open(configuration.databasePath);
    application = createApp({
      store,
      trustProxyHops: configuration.trustProxyHops,
      ai: configuration.ai,
      googleOAuth: configuration.googleOAuth,
      allowedOrigins: configuration.allowedOrigins,
      recoveryMailer: recoveryMailerFromEnv(process.env),
    });
  } catch (error) {
    // No application requests were accepted. Finish database cleanup while the
    // port is still reserved, then release it without a success/ready signal.
    try {
      store?.close();
    } finally {
      await closeListener();
    }
    throw error;
  }
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : configuration.port;
  console.log(
    `Solace API ready on port ${port}. AI mode: ${provider(configuration.ai) === "live" ? "live provider" : "offline companion"}.`,
  );
  if (process.send && process.connected)
    process.send(
      {
        type: "solace:ready",
        port,
        host:
          typeof address === "object" && address
            ? address.address
            : configuration.host,
      },
      () => {},
    );
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    void closeListener().then(() => {
      store!.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

start().catch((error: unknown) => {
  console.error(
    "Solace API could not start:",
    error instanceof Error ? error.message : "Unknown startup error.",
  );
  process.exitCode = 1;
});
