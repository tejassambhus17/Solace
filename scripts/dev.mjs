import supervisor from "./dev-supervisor.cjs";

try {
  const session = supervisor.createDevelopmentSession({
    args: process.argv.slice(2),
  });
  process.exitCode = await session.done;
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Solace development startup failed.",
  );
  process.exitCode = 1;
}
