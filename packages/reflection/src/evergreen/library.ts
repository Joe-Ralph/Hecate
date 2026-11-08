import rawLibrary from './library.json';

export interface EvergreenItem {
  id: string;
  title: string;
  steps: string[];
  category: string;
  durationMin: number;
  cooldownDays: number;
  timeOfDay: ('morning' | 'afternoon' | 'evening')[];
  energy: 'low' | 'medium' | 'high';
  needs: string[];
}

export const EVERGREEN_LIBRARY: EvergreenItem[] = rawLibrary as EvergreenItem[];

export function getTimeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function filterEvergreenLibrary(
  items: EvergreenItem[],
  options: {
    category?: string;
    mutedIds?: Set<string>;
    cooldowns?: Record<string, number>; // id -> lastCompletedAt / lastShownAt
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    disabledNeeds?: Set<string>;
    now?: number;
  } = {}
): EvergreenItem[] {
  const now = options.now || Date.now();
  const time = options.timeOfDay || getTimeOfDay(new Date(now));
  const muted = options.mutedIds || new Set<string>();
  const cooldowns = options.cooldowns || {};
  const disabledNeeds = options.disabledNeeds || new Set<string>();

  return items.filter((item) => {
    if (muted.has(item.id)) return false;
    if (options.category && item.category !== options.category) return false;
    if (item.timeOfDay && item.timeOfDay.length > 0 && !item.timeOfDay.includes(time)) {
      // allow fallback if matching category
    }
    if (item.needs && item.needs.some((n) => disabledNeeds.has(n))) return false;

    const lastShown = cooldowns[item.id];
    if (lastShown) {
      const daysSince = (now - lastShown) / (1000 * 60 * 60 * 24);
      if (daysSince < (item.cooldownDays || 2)) return false;
    }

    return true;
  });
}
