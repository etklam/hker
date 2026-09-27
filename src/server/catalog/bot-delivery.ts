import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { botChatLeases, botRunnerState, botSessions, botUpdates } from "@/db/schema/directory";
import { CatalogSearchService, configureCatalogTransaction, getTaxonomy } from "./service";
import { telegram, TelegramDeliveryError, contentVersion } from "./bot-transport";

export type BotDeliveryConfig = { leaseSeconds: number; maxAttempts: number; maxAgeSeconds: number; baseDelayMs: number; maxDelayMs: number; jitterRatio: number };
const integerEnv = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(process.env[name] ?? fallback);
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};
export function getBotDeliveryConfig(): BotDeliveryConfig {
    const jitter = Number(process.env.BOT_RETRY_JITTER_RATIO ?? 0.2);
    return {
        leaseSeconds: integerEnv("BOT_LEASE_SECONDS", 120, 30, 900),
        maxAttempts: integerEnv("BOT_MAX_ATTEMPTS", 6, 1, 20),
        maxAgeSeconds: integerEnv("BOT_MAX_AGE_SECONDS", 86400, 60, 604800),
        baseDelayMs: integerEnv("BOT_RETRY_BASE_MS", 1000, 100, 60000),
        maxDelayMs: integerEnv("BOT_RETRY_MAX_MS", 300000, 1000, 3600000),
        jitterRatio: Number.isFinite(jitter) && jitter >= 0 && jitter <= 1 ? jitter : 0.2,
    };
}
const currentTime = (now?: Date) => now ? sql`${now}` : sql`now()`;
const leaseUntil = (seconds: number, now?: Date) => sql`${currentTime(now)} + ${seconds} * interval '1 second'`;
const ownsUpdate = (id: number, owner: string) => and(eq(botUpdates.id, id), eq(botUpdates.leaseOwner, owner));

type BotDeliveryOptions = {
    owner?: string;
    signal?: AbortSignal;
    random?: () => number;
    config?: BotDeliveryConfig;
    now?: Date;
    onClaim?: () => void;
    onExpired?: () => void;
    onRetry?: () => void;
};

export async function deliverCatalogUpdate(id: number, options: BotDeliveryOptions = {}) {
    const owner = options.owner ?? randomUUID();
    const config = options.config ?? getBotDeliveryConfig();
    const random = options.random ?? Math.random;
    const now = currentTime(options.now);
    const job = await db.transaction(async (tx) => {
        await configureCatalogTransaction(tx);
        const [expired] = await tx.update(botUpdates).set({ status: "failed", completedAt: now, errorClass: "expired", lastError: "Delivery age limit exceeded", updatedAt: now, leaseOwner: null, lockedUntil: null })
            .where(and(eq(botUpdates.id, id), sql`${botUpdates.status} not in ('complete','failed')`, sql`${botUpdates.createdAt} < ${now} - ${config.maxAgeSeconds} * interval '1 second'`, sql`(${botUpdates.lockedUntil} is null or ${botUpdates.lockedUntil} < ${now})`)).returning({ id: botUpdates.id });
        if (expired) return { expired: true as const };
        const [candidate] = await tx.select().from(botUpdates).where(eq(botUpdates.id, id)).for("update", { skipLocked: true });
        if (!candidate || !candidate.conversationKey || ["complete", "failed"].includes(candidate.status)) return;
        const chatKey = candidate.chatKey ?? candidate.conversationKey.split(":", 1)[0];
        await tx.insert(botChatLeases).values({ key: chatKey }).onConflictDoNothing();
        const [chatLease] = await tx.update(botChatLeases).set({ leaseOwner: owner, lockedUntil: leaseUntil(config.leaseSeconds, options.now), updatedAt: now })
            .where(and(eq(botChatLeases.key, chatKey), sql`(${botChatLeases.lockedUntil} is null or ${botChatLeases.lockedUntil} < ${now})`)).returning({ key: botChatLeases.key });
        if (!chatLease) return;
        const releaseChat = () => tx.update(botChatLeases).set({ leaseOwner: null, lockedUntil: null, updatedAt: now }).where(and(eq(botChatLeases.key, chatKey), eq(botChatLeases.leaseOwner, owner)));
        const [session] = await tx.update(botSessions).set({ leaseOwner: owner, lockedUntil: leaseUntil(config.leaseSeconds, options.now), updatedAt: now })
            .where(and(eq(botSessions.key, candidate.conversationKey), sql`(${botSessions.lockedUntil} is null or ${botSessions.lockedUntil} < ${now})`)).returning();
        if (!session) { await releaseChat(); return; }
        const releaseSession = () => tx.update(botSessions).set({ leaseOwner: null, lockedUntil: null, updatedAt: now }).where(and(eq(botSessions.key, candidate.conversationKey!), eq(botSessions.leaseOwner, owner)));
        const [older] = await tx.select({ id: botUpdates.id }).from(botUpdates).where(and(
            sql`coalesce(${botUpdates.chatKey}, split_part(${botUpdates.conversationKey}, ':', 1)) = ${chatKey}`,
            sql`${botUpdates.id} < ${id}`, sql`${botUpdates.status} not in ('complete', 'failed')`,
        )).orderBy(botUpdates.id).limit(1);
        if (older) { await releaseSession(); await releaseChat(); return; }
        const [claimed] = await tx.update(botUpdates).set({ leaseOwner: owner, lockedUntil: leaseUntil(config.leaseSeconds, options.now), status: "delivering", lastAttemptAt: now, updatedAt: now })
            .where(and(eq(botUpdates.id, id), sql`${botUpdates.nextAttemptAt} <= ${now}`, sql`(${botUpdates.lockedUntil} is null or ${botUpdates.lockedUntil} < ${now})`)).returning();
        if (!claimed) { await releaseSession(); await releaseChat(); return; }
        return { ...claimed, chatKey, messageId: session.messageId, expired: false as const };
    });
    if (!job) return false;
    if (job.expired) { options.onExpired?.(); return false; }
    options.onClaim?.();
    const owns = ownsUpdate(id, owner);
    const renew = async () => {
        const [chat] = await db.update(botChatLeases).set({ lockedUntil: leaseUntil(config.leaseSeconds, options.now), updatedAt: now }).where(and(eq(botChatLeases.key, job.chatKey), eq(botChatLeases.leaseOwner, owner))).returning({ key: botChatLeases.key });
        const [session] = await db.update(botSessions).set({ lockedUntil: leaseUntil(config.leaseSeconds, options.now), updatedAt: now }).where(and(eq(botSessions.key, job.conversationKey!), eq(botSessions.leaseOwner, owner))).returning({ key: botSessions.key });
        const [update] = await db.update(botUpdates).set({ lockedUntil: leaseUntil(config.leaseSeconds, options.now), updatedAt: now }).where(owns).returning({ id: botUpdates.id });
        return Boolean(chat && session && update);
    };
    try {
        let messageId = job.messageId;
        const taxonomyVersion = contentVersion(await getTaxonomy("bot"));
        for (let i = job.nextOperation; i < job.operations.length; i++) {
            if (options.signal?.aborted) throw new TelegramDeliveryError("Runner shutting down", true, 0, undefined, "runner shutdown", undefined, "network");
            if (!await renew()) return false;
            const operation = job.operations[i];
            const slugs = operation.listingSlugs ?? (operation.listingSlug ? [operation.listingSlug] : []);
            let visible = !operation.taxonomyVersion || operation.taxonomyVersion === taxonomyVersion;
            for (const slug of slugs) {
                const current = await CatalogSearchService.detail(slug, "bot");
                if (!current || (operation.listingVersions?.[slug] && operation.listingVersions[slug] !== contentVersion(current))) visible = false;
            }
            const body: Record<string, unknown> = visible ? { ...operation.body } : { ...operation.body, text: "目錄內容已更新，請重新查看結果。", reply_markup: { inline_keyboard: [] } };
            let method = operation.method;
            if (method === "sendMessage" && messageId) { method = "editMessageText"; body.message_id = messageId; }
            if (!await renew()) return false;
            const result = await telegram(method, body, Math.min(15000, config.leaseSeconds * 500));
            if (result.message_id) {
                messageId = result.message_id;
                await db.update(botSessions).set({ messageId, updatedAt: now }).where(and(eq(botSessions.key, job.conversationKey!), eq(botSessions.leaseOwner, owner)));
            }
            const [progressed] = await db.update(botUpdates).set({ nextOperation: i + 1, updatedAt: now }).where(owns).returning({ id: botUpdates.id });
            if (!progressed) return false;
        }
        const [completed] = await db.update(botUpdates).set({ status: "complete", completedAt: now, lastError: null, errorClass: null, updatedAt: now }).where(owns).returning({ id: botUpdates.id });
        return Boolean(completed);
    } catch (error) {
        const attempts = job.attempts + 1;
        const failure = error instanceof TelegramDeliveryError ? error : new TelegramDeliveryError("Unexpected delivery failure", true, 0, undefined, "unexpected failure", undefined, "unexpected");
        const terminal = !failure.retryable || attempts >= config.maxAttempts;
        const exponential = Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** Math.max(0, attempts - 1));
        const jittered = Math.max(0, Math.round(exponential * (1 + (random() * 2 - 1) * config.jitterRatio)));
        const delayMs = Math.max(failure.retryAfter * 1000, jittered);
        const [persistedFailure] = await db.update(botUpdates).set({ attempts, status: terminal ? "failed" : "retry", errorClass: failure.classification, lastError: failure.description, nextAttemptAt: sql`least(${now} + ${delayMs} * interval '1 millisecond', ${job.createdAt} + ${config.maxAgeSeconds} * interval '1 second')`, completedAt: terminal ? now : null, updatedAt: now }).where(owns).returning({ id: botUpdates.id });
        if (!terminal && persistedFailure) options.onRetry?.();
        return false;
    } finally {
        await db.update(botUpdates).set({ leaseOwner: null, lockedUntil: null, updatedAt: now }).where(owns);
        await db.update(botSessions).set({ leaseOwner: null, lockedUntil: null, updatedAt: now }).where(and(eq(botSessions.key, job.conversationKey!), eq(botSessions.leaseOwner, owner)));
        await db.update(botChatLeases).set({ leaseOwner: null, lockedUntil: null, updatedAt: now }).where(and(eq(botChatLeases.key, job.chatKey), eq(botChatLeases.leaseOwner, owner)));
    }
}

export async function recordBotRunnerHeartbeat(runnerId: string, at?: Date) {
    const now = currentTime(at);
    await db.insert(botRunnerState).values({ key: `process:${runnerId}`, runnerId, heartbeatAt: now, updatedAt: now }).onConflictDoUpdate({ target: botRunnerState.key, set: { runnerId, heartbeatAt: now, updatedAt: now } });
}
async function recordBotDeliveryProgress(runnerId: string, at?: Date) {
    const now = currentTime(at);
    await db.insert(botRunnerState).values({ key: `progress:${runnerId}`, runnerId, heartbeatAt: now, updatedAt: now }).onConflictDoUpdate({ target: botRunnerState.key, set: { runnerId, heartbeatAt: now, updatedAt: now } });
}
export async function runBotDelivery(limit = 100, options: { signal?: AbortSignal; concurrency?: number; runnerId?: string; now?: Date; config?: BotDeliveryConfig } = {}) {
    const runnerId = options.runnerId ?? randomUUID();
    const config = options.config ?? getBotDeliveryConfig();
    const now = currentTime(options.now);
    const cap = Math.min(100, Math.max(1, limit));
    await recordBotRunnerHeartbeat(runnerId, options.now);
    const jobs = await db.execute<{ id: number; chatKey: string }>(sql`
        with candidates as (
            select u.id
            from directory_bot_updates u
            where u.status in ('pending', 'delivering', 'retry')
              and u.next_attempt_at <= ${now}
            union
            select u.id
            from directory_bot_updates u
            where u.status in ('pending', 'delivering', 'retry')
              and u.created_at < ${now} - ${config.maxAgeSeconds} * interval '1 second'
        ), runnable as (
            select u.id,
                   coalesce(u.chat_key, split_part(u.conversation_key, ':', 1)) as chat_key,
                   row_number() over (
                       partition by coalesce(u.chat_key, split_part(u.conversation_key, ':', 1))
                       order by u.id
                   ) as position
            from candidates candidate
            join directory_bot_updates u on u.id = candidate.id
            left join directory_bot_sessions s on s.key = u.conversation_key
            left join directory_bot_chat_leases c on c.key = coalesce(u.chat_key, split_part(u.conversation_key, ':', 1))
            where u.conversation_key is not null
              and (u.locked_until is null or u.locked_until < ${now})
              and (s.locked_until is null or s.locked_until < ${now})
              and (c.locked_until is null or c.locked_until < ${now})
              and (u.chat_key is null or not exists (
                  select 1
                  from directory_bot_updates older
                  left join directory_bot_sessions older_session on older_session.key = older.conversation_key
                  where older.chat_key = u.chat_key
                    and older.id < u.id
                    and older.status in ('pending', 'delivering', 'retry')
                    and (
                        (older.next_attempt_at > ${now} and older.created_at >= ${now} - ${config.maxAgeSeconds} * interval '1 second')
                        or older.locked_until >= ${now}
                        or older_session.locked_until >= ${now}
                    )
              ))
              and (u.chat_key is null or not exists (
                  select 1
                  from directory_bot_updates older
                  left join directory_bot_sessions older_session on older_session.key = older.conversation_key
                  where older.chat_key is null
                    and split_part(older.conversation_key, ':', 1) = u.chat_key
                    and older.id < u.id
                    and older.status in ('pending', 'delivering', 'retry')
                    and (
                        (older.next_attempt_at > ${now} and older.created_at >= ${now} - ${config.maxAgeSeconds} * interval '1 second')
                        or older.locked_until >= ${now}
                        or older_session.locked_until >= ${now}
                    )
              ))
              and (u.chat_key is not null or not exists (
                  select 1
                  from directory_bot_updates older
                  left join directory_bot_sessions older_session on older_session.key = older.conversation_key
                  where coalesce(older.chat_key, split_part(older.conversation_key, ':', 1)) = split_part(u.conversation_key, ':', 1)
                    and older.id < u.id
                    and older.status in ('pending', 'delivering', 'retry')
                    and (
                        (older.next_attempt_at > ${now} and older.created_at >= ${now} - ${config.maxAgeSeconds} * interval '1 second')
                        or older.locked_until >= ${now}
                        or older_session.locked_until >= ${now}
                    )
              ))
        )
        select id, chat_key as "chatKey"
        from runnable
        order by position, id
        limit ${cap}
    `);
    const chats = new Map<string, number[]>();
    for (const job of jobs) {
        const group = chats.get(job.chatKey) ?? [];
        group.push(job.id);
        chats.set(job.chatKey, group);
    }
    const groups = [...chats.values()];
    let cursor = 0, claimed = 0, completed = 0, expired = 0, retried = 0;
    const worker = async () => {
        while (!options.signal?.aborted) {
            const group = groups[cursor++];
            if (!group) return;
            for (const id of group) {
                if (options.signal?.aborted) return;
                const delivered = await deliverCatalogUpdate(id, {
                    signal: options.signal,
                    now: options.now,
                    config,
                    onClaim: () => { claimed++; },
                    onExpired: () => { expired++; },
                    onRetry: () => { retried++; },
                });
                if (!delivered) break;
                completed++;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(groups.length || 1, Math.max(1, Math.min(16, options.concurrency ?? 4))) }, worker));
    await recordBotRunnerHeartbeat(runnerId, options.now);
    if (completed > 0) await recordBotDeliveryProgress(runnerId, options.now);
    return { scanned: jobs.length, eligible: jobs.length, claimed, completed, retried, expired, blocked: jobs.length - claimed - expired };
}

export async function cleanupBotState(batchSize = 500) {
    const batch = Math.min(5000, Math.max(1, batchSize));
    const bodyIds = db.select({ id: botUpdates.id }).from(botUpdates).where(sql`${botUpdates.status} in ('complete','failed') and ${botUpdates.completedAt} < now() - interval '7 days' and jsonb_array_length(${botUpdates.operations}) > 0`).orderBy(botUpdates.id).limit(batch);
    const bodies = await db.update(botUpdates).set({ operations: [], nextOperation: 0, updatedAt: sql`now()` }).where(inArray(botUpdates.id, bodyIds)).returning({ id: botUpdates.id });
    const jobIds = db.select({ id: botUpdates.id }).from(botUpdates).where(sql`${botUpdates.status} in ('complete','failed') and ${botUpdates.completedAt} < now() - interval '30 days' and ${botUpdates.lockedUntil} is null`).orderBy(botUpdates.id).limit(batch);
    const jobs = await db.delete(botUpdates).where(inArray(botUpdates.id, jobIds)).returning({ id: botUpdates.id });
    const sessionKeys = db.select({ key: botSessions.key }).from(botSessions).where(sql`${botSessions.updatedAt} < now() - interval '7 days' and (${botSessions.lockedUntil} is null or ${botSessions.lockedUntil} < now()) and not exists (select 1 from directory_bot_updates u where u.conversation_key = ${botSessions.key} and u.status not in ('complete','failed'))`).orderBy(botSessions.key).limit(batch);
    const sessions = await db.delete(botSessions).where(inArray(botSessions.key, sessionKeys)).returning({ key: botSessions.key });
    const chatKeys = db.select({ key: botChatLeases.key }).from(botChatLeases).where(sql`${botChatLeases.updatedAt} < now() - interval '7 days' and (${botChatLeases.lockedUntil} is null or ${botChatLeases.lockedUntil} < now()) and not exists (select 1 from directory_bot_updates u where u.chat_key = ${botChatLeases.key} and u.status not in ('complete','failed'))`).orderBy(botChatLeases.key).limit(batch);
    const chats = await db.delete(botChatLeases).where(inArray(botChatLeases.key, chatKeys)).returning({ key: botChatLeases.key });
    const runners = await db.delete(botRunnerState).where(sql`(${botRunnerState.key} like 'process:%' or ${botRunnerState.key} like 'progress:%') and ${botRunnerState.updatedAt} < now() - interval '30 days'`).returning({ key: botRunnerState.key });
    return { bodies: bodies.length, jobs: jobs.length, sessions: sessions.length, chats: chats.length, runners: runners.length };
}

export async function getBotDeliveryStatus() {
    const counts = await db.execute(sql`select status, count(*)::int as count from directory_bot_updates group by status order by status`);
    const [age] = await db.execute(sql`select greatest(0, extract(epoch from (now() - min(created_at))))::int as seconds from directory_bot_updates where status not in ('complete','failed')`);
    const runners = await db.execute(sql`
      select process.runner_id as "runnerId", process.heartbeat_at as "heartbeatAt",
             progress.heartbeat_at as "progressAt"
      from directory_bot_runner_state process
      left join directory_bot_runner_state progress
        on progress.key = 'progress:' || process.runner_id
      where process.key like 'process:%'
      order by process.heartbeat_at desc
      limit 20
    `);
    const [legacyHeartbeat] = await db.select().from(botRunnerState).where(eq(botRunnerState.key, "delivery"));
    const [heartbeat] = runners;
    const errors = await db.execute(sql`select coalesce(error_class, 'unknown') as class, count(*)::int as count from directory_bot_updates where status = 'failed' group by error_class order by count desc limit 10`);
    return { counts, oldestPendingSeconds: Number(age?.seconds ?? 0), heartbeat: heartbeat ? { at: heartbeat.heartbeatAt, runnerId: heartbeat.runnerId } : legacyHeartbeat ? { at: legacyHeartbeat.heartbeatAt, runnerId: legacyHeartbeat.runnerId } : null, runners, errors };
}
