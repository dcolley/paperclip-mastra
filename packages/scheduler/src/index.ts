import './heartbeat-worker';
import './routine-scheduler';
import './approval-wake-worker';

process.on('SIGTERM', async () => { process.exit(0); });
process.on('SIGINT', async () => { process.exit(0); });

console.log('[scheduler] All workers started.');
