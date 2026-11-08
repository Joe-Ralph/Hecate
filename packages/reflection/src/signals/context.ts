import { StorageAdapter } from '@hecate/storage';

export interface UserContext {
  localHour: number;
  weekday: number; // 0 = Sunday, 1 = Monday, ...
  reflectionsDoneToday: number;
  medianCompletedDurationMin: number;
  availableMinutes: number;
}

/**
 * S8 Context (Section 5)
 */
export async function getUserContext(adapter: StorageAdapter, now: number = Date.now()): Promise<UserContext> {
  const d = new Date(now);
  const localHour = d.getHours();
  const weekday = d.getDay();

  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  // Reflections done today
  const doneTodayRows = await adapter.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reflection
     WHERE status = 'done' AND resolved_at >= ?`,
    [startOfDay]
  );
  const reflectionsDoneToday = Number(doneTodayRows[0]?.count || 0);

  // Completed durations
  const completedRows = await adapter.query<{ duration_min: number }>(
    `SELECT duration_min FROM reflection
     WHERE status = 'done' AND duration_min IS NOT NULL
     ORDER BY duration_min ASC
     LIMIT 50`
  );

  let medianCompletedDurationMin = 15;
  if (completedRows.length > 0) {
    const mid = Math.floor(completedRows.length / 2);
    medianCompletedDurationMin = completedRows[mid].duration_min;
  }

  return {
    localHour,
    weekday,
    reflectionsDoneToday,
    medianCompletedDurationMin,
    availableMinutes: 30,
  };
}
