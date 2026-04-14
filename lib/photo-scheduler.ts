import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { photoRequests, photoSchedules, sits } from '@/db/schema';

export const PHOTO_CHECK_TASK = 'GROTTO_PHOTO_CHECK';

function isWithinTriggerWindow(triggerTime: string, windowMinutes = 5): boolean {
  const now = new Date();
  const [hours, minutes] = triggerTime.split(':').map(Number);
  const triggerDate = new Date();
  triggerDate.setHours(hours, minutes, 0, 0);
  const diffMs = Math.abs(now.getTime() - triggerDate.getTime());
  return diffMs <= windowMinutes * 60 * 1000;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export async function runPhotoSchedulerCheck() {
  const liveSits = await db
    .select()
    .from(sits)
    .where(eq(sits.status, 'live'));

  for (const sit of liveSits) {
    if (!sit.sitterId) continue;

    const schedules = await db
      .select()
      .from(photoSchedules)
      .where(eq(photoSchedules.sitId, sit.id));

    for (const schedule of schedules) {
      if (!schedule.isActive || !schedule.triggerTime) continue;
      if (!isWithinTriggerWindow(schedule.triggerTime)) continue;

      // Check if a request already exists for today
      const today = todayISO();
      const existing = await db
        .select()
        .from(photoRequests)
        .where(eq(photoRequests.scheduleId, schedule.id));

      const alreadyTriggeredToday = existing.some((r) =>
        r.requestedAt.startsWith(today)
      );
      if (alreadyTriggeredToday) continue;

      const requestedAt = new Date().toISOString();
      const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await db.insert(photoRequests).values({
        sitId: sit.id,
        scheduleId: schedule.id,
        sitterId: sit.sitterId,
        status: 'pending',
        requestedAt,
        dueAt,
        notificationSent: 0,
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for a photo! 📸`,
          body: schedule.label,
          data: { sitId: sit.id, scheduleId: schedule.id },
        },
        trigger: null,
      });
    }
  }
}

export function registerPhotoSchedulerTask() {
  TaskManager.defineTask(PHOTO_CHECK_TASK, async () => {
    try {
      await runPhotoSchedulerCheck();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function startPhotoSchedulerBackgroundFetch() {
  await BackgroundFetch.registerTaskAsync(PHOTO_CHECK_TASK, {
    minimumInterval: 60 * 15,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
