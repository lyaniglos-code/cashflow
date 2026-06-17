import cron from 'node-cron';
import { onAnyRefresh } from './bus.js';
import { runDailyChecks, runHourlyChecks, flushQueue, handleDataChange } from './notifications.js';

// Schedules the notification jobs. node-cron uses the server's local time for
// the schedule itself; per-user timezone handling (quiet hours, the Monday-8am
// pulse) is done inside notifications.js.
export function startCron() {
  // Daily 09:00 — shortfall + improvement checks across all opted-in users.
  cron.schedule('0 9 * * *', () => {
    runDailyChecks().catch((e) => console.error('[cron daily]', e.message));
  });

  // Hourly — weekly pulse (self-gates to Mon 8am in each user's timezone) +
  // flush any queued (quiet-hours) messages now due.
  cron.schedule('0 * * * *', () => {
    runHourlyChecks().catch((e) => console.error('[cron hourly]', e.message));
  });

  // Every 10 minutes — drain the quiet-hours queue as soon as messages come due.
  cron.schedule('*/10 * * * *', () => {
    flushQueue().catch((e) => console.error('[cron flush]', e.message));
  });

  // Real-time: react to any user data change (new/synced transaction, scenario)
  // for immediate threshold-breach and improvement alerts.
  onAnyRefresh((userId) => {
    handleDataChange(userId).catch((e) => console.error('[cron realtime]', e.message));
  });

  console.log('  Notifications: cron active (daily 9am, hourly pulse, 10-min queue flush) + real-time triggers');
}
