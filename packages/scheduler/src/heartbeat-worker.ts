import { Worker, type Job } from 'bullmq';
import { connection } from './redis';
import { db, agents, heartbeatRuns, companies, costEvents } from '@paperclip-mastra/db';
import { eq, and, sql } from 'drizzle-orm';
import { createAgentWithSkills } from '@paperclip-mastra/mastra';
import type { HeartbeatJobData } from '@paperclip-mastra/shared';
import { QUEUE_HEARTBEAT, DEFAULT_HEARTBEAT_TIMEOUT_SEC } from '@paperclip-mastra/shared';
import { randomUUID } from 'crypto';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10);

export const heartbeatWorker = new Worker<HeartbeatJobData>(
  QUEUE_HEARTBEAT,
  processHeartbeat,
  { connection, concurrency: CONCURRENCY, stalledInterval: 30_000 }
);

heartbeatWorker.on('completed', (job) =>
  console.log(`[heartbeat] done: agent=${job.data.agentId} job=${job.id}`)
);
heartbeatWorker.on('failed', (job, err) =>
  console.error(`[heartbeat] failed: agent=${job?.data.agentId}`, err.message)
);

async function processHeartbeat(job: Job<HeartbeatJobData>): Promise<void> {
  const { agentId, companyId, invocationSource, wakeReason, wakePayloadJson } = job.data;

  const agentRecord = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.companyId, companyId)),
  });
  if (!agentRecord) throw new Error(`Agent ${agentId} not found`);

  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new Error(`Company ${companyId} not found`);

  if (agentRecord.status !== 'active') return;
  if (company.status !== 'active') return;
  if (agentRecord.spentMonthlyTokens >= agentRecord.budgetMonthlyTokens) return;

  const runId = randomUUID();
  await db.insert(heartbeatRuns).values({
    id: runId, agentId, companyId, invocationSource, status: 'running',
    contextSnapshot: { wakeReason, wakePayloadJson }, startedAt: new Date(),
  });

  const apiKey = buildRunScopedApiKey(runId, agentId, companyId);
  const agent = await createAgentWithSkills(agentRecord);
  const wakeMessage = buildWakeMessage(job.data);
  const timeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_SEC * 1000;

  try {
    const result = await Promise.race([
      agent.generate(wakeMessage, {
        runtimeContext: new Map([
          ['apiKey', apiKey], ['runId', runId],
          ['agentId', agentId], ['companyId', companyId],
        ]),
        maxSteps: 30,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Heartbeat timeout')), timeoutMs)
      ),
    ]);

    if (result.usage) {
      const total = (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0);
      await db.insert(costEvents).values({
        agentId, companyId, runId,
        provider: 'lmstudio', model: agentRecord.modelId ?? 'unknown',
        inputTokens: result.usage.promptTokens ?? 0,
        outputTokens: result.usage.completionTokens ?? 0,
        costCents: 0,
      });
      await db.update(agents)
        .set({ spentMonthlyTokens: sql`${agents.spentMonthlyTokens} + ${total}` })
        .where(eq(agents.id, agentId));
    }

    await db.update(heartbeatRuns)
      .set({ status: 'succeeded', finishedAt: new Date() })
      .where(eq(heartbeatRuns.id, runId));
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    await db.update(heartbeatRuns)
      .set({ status: 'failed', finishedAt: new Date(), errorText })
      .where(eq(heartbeatRuns.id, runId));
    throw err;
  }
}

function buildWakeMessage(data: HeartbeatJobData): string {
  const parts = [`Wake reason: ${data.wakeReason}`];
  if (data.taskId) parts.push(`Assigned task ID: ${data.taskId}`);
  if (data.wakePayloadJson) {
    try {
      const payload = JSON.parse(data.wakePayloadJson);
      if (payload.issue) parts.push(`Task: ${payload.issue.identifier} — ${payload.issue.title}`);
    } catch { /* ignore */ }
  }
  parts.push('\nBegin your heartbeat procedure. Follow SKILL: Control Plane Operations exactly.');
  return parts.join('\n');
}

function buildRunScopedApiKey(runId: string, agentId: string, companyId: string): string {
  const payload = JSON.stringify({ runId, agentId, companyId, iat: Date.now() });
  return `pm_run_${Buffer.from(payload).toString('base64url')}`;
}
