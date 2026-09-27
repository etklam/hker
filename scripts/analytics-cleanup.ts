import { cleanupAnalytics } from "../src/server/catalog/analytics";
import { cleanupContentOperations } from "../src/server/catalog/content-cleanup";
import { closeDatabase } from "../src/server/db";
Promise.all([cleanupAnalytics(), cleanupContentOperations()])
  .then(([analytics, content]) =>
    console.log(
      `Retention applied: ${analytics.aggregates} aggregate rows, ${analytics.receipts} receipts, ${content.plans} plans and ${content.history} history rows removed`,
    ),
  )
  .catch(() => {
    console.error("Analytics cleanup failed");
    process.exitCode = 1;
  })
  .finally(closeDatabase);
