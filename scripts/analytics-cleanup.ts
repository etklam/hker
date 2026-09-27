import { cleanupAnalytics } from "../src/server/catalog/analytics";
import { closeDatabase } from "../src/server/db";
cleanupAnalytics()
  .then(() => console.log("Analytics retention applied"))
  .catch(() => {
    console.error("Analytics cleanup failed");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
