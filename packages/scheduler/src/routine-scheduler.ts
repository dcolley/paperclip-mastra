import { connection } from './redis';
import { db, routines } from '@paperclip-mastra/db';
import { eq, and } from 'drizzle-orm';
import { enqueueHeartbeat } from './heartbeat-queue';

const POLL_INTERVAL_MS = 60_000;

let routineTimer: ReturnType<typeof setInterval>;

export function startRoutineScheduler(): void {
  routineTimer = setInterval(fireReadyRoutines, POLL_INTERVAL_MS);
  console.log('[routine-scheduler] Started, polling every 60s');
}

async function fireReadyRoutines(): Promise<void> {
  const now = new Date();
  const activeRoutines = await db.query.routines.findMany({
    where: eq(routines.enabled, true),
  } as Parameters<typeof db.query.routines.findMany>[0]);

  for (const routine of activeRoutines) {
    if (!shouldFire(routine, now)) continue;
    try {
      const res = await fetch(`${process.env.INTERNAL_API_URL}/api/companies/${routine.companyId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SCHEDULER_API_KEY}` },
        body: JSON.stringify({ ...(routine.taskTemplate as object), routineId: routine.id, assigneeAgentId: routine.agentId, source: 'routine' }),
      });
      const newIssue = await res.json() as { id: string };
      await enqueueHeartbeat({ agentId: routine.agentId, companyId: routine.companyId, invocationSource: 'timer', wakeReason: 'timer', taskId: newIssue.id });
      await db.update(routines).set({ lastFiredAt: now }).where(eq(routines.id, routine.id));
    } catch (err) {
      console.error(`[routine-scheduler] Failed:`, err);
    }
  }
}

function shouldFire(routine: { cronExpression: string; lastFiredAt: Date | null }, now: Date): boolean {
  if (!routine.lastFiredAt) return true;
  return now.getTime() - routine.lastFiredAt.getTime() >= 60_000;
}

startRoutineScheduler();
