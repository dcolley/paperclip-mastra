import { Worker, type Job } from 'bullmq';
import { connection } from './redis';
import { enqueueHeartbeat } from './heartbeat-queue';
import { QUEUE_APPROVAL_WAKES } from '@paperclip-mastra/shared';

interface ApprovalWakeJobData {
  approvalId: string;
  agentId: string;
  companyId: string;
  status: 'approved' | 'rejected';
  linkedIssueIds?: string[];
}

export const approvalWakeWorker = new Worker<ApprovalWakeJobData>(
  QUEUE_APPROVAL_WAKES,
  async (job: Job<ApprovalWakeJobData>) => {
    await enqueueHeartbeat({
      agentId: job.data.agentId, companyId: job.data.companyId,
      invocationSource: 'approval_resolved', wakeReason: 'approval_resolved',
      approvalId: job.data.approvalId, approvalStatus: job.data.status,
      linkedIssueIds: job.data.linkedIssueIds,
    }, { deduplicate: false, priority: 1 });
  },
  { connection, concurrency: 10 }
);
