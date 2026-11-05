// Test-only preloader: hold the real startup immediately before database opening.
import { Store } from "../../dist/database.js";
const open = Store.open.bind(Store);
Store.open = async (...arguments_) => {
  const continued = new Promise((resolve) => {
    const listener = (message) => {
      if (message?.type !== "test:continue-database") return;
      process.removeListener("message", listener);
      resolve();
    };
    process.on("message", listener);
  });
  process.send?.({ type: "test:database-opening" });
  await continued;
  return open(...arguments_);
};
