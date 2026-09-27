import { randomUUID } from "node:crypto";
import { closeDatabase } from "../src/server/db";
import { cleanupBotState, getBotDeliveryStatus, recordBotRunnerHeartbeat, runBotDelivery } from "../src/server/catalog/bot-delivery";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => controller.abort());
const numberArg = (name: string, fallback: number) => {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? Number(process.argv[index + 1]) : fallback;
    return Number.isInteger(value) && value > 0 ? value : fallback;
};
const wait = (ms: number) => new Promise<void>((resolve) => {
    if (controller.signal.aborted) return resolve();
    const finish = () => {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", finish);
        resolve();
    };
    const timer = setTimeout(finish, ms);
    controller.signal.addEventListener("abort", finish, { once: true });
});

async function main() {
    const runnerId = randomUUID();
    const limit = Math.min(100, numberArg("--limit", 100));
    if (process.argv.includes("--cleanup")) return cleanupBotState(numberArg("--batch", 500));
    if (process.argv.includes("--status")) return getBotDeliveryStatus();
    if (!process.argv.includes("--watch")) return runBotDelivery(limit, { signal: controller.signal, runnerId });
    let scanned = 0, completed = 0;
    while (!controller.signal.aborted) {
        const result = await runBotDelivery(limit, { signal: controller.signal, runnerId });
        scanned += result.scanned; completed += result.completed;
        if (!result.completed) await wait(numberArg("--interval-ms", 1000));
    }
    await recordBotRunnerHeartbeat(runnerId);
    return { scanned, completed, stopped: true };
}

main()
    .then((result) => { console.log(JSON.stringify(result)); })
    .catch((error) => {
        console.error(JSON.stringify({ error: "bot_runner_failed", code: typeof error?.code === "string" ? error.code.slice(0, 40) : "unknown" }));
        process.exitCode = 1;
    })
    .finally(async () => { await closeDatabase(); });
