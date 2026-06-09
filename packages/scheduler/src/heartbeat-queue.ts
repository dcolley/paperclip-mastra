import { Queue, QueueEvents } from 'bullmq';
import { connection } from './redis';
import type { HeartbeatJobData } from '@paperclip-mastra/shared';
import { QUEUE_HEARTBEAT } from '@paperclip-mastra/shared';

/**
 * Central heartbeat queue. All agent wakes go through here.
 *
 * Deduplication: jobId = `hb:{agentId}` ensures at-most-one queued job
 * per agent. If a new wake arrives while a job is queued, BullMQ ignores
 * the duplicate. Jobs that are ACTIVE (running) are not deduplicated.
 */
export const heartbeatQueue = new Queue<HeartbeatJobData>(QUEUE_HEARTBEAT, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueHeartbeat(
  data: HeartbeatJobData,
  opts: { delay?: number; priority?: number; deduplicate?: boolean } = {}
): Promise<string | undefined> {
  const { delay = 0, priority, deduplicate = true } = opts;
  const jobId = deduplicate ? `hb:${data.agentId}` : undefined;
  const job = await heartbeatQueue.add(`heartbeat:${data.agentId}`, data, { jobId, delay, priority });
  return job.id;
}
