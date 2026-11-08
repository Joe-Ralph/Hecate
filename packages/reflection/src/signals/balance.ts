import { StorageAdapter } from '@hecate/storage';

export const CATEGORIES = [
  'learning',
  'health',
  'relationships',
  'finance',
  'creativity',
  'mindfulness',
  'rest',
  'home',
  'work',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const TAG_CATEGORY_MAP: Record<string, Category> = {
  book: 'learning',
  article: 'learning',
  course: 'learning',
  study: 'learning',
  habit: 'health',
  workout: 'health',
  health: 'health',
  diet: 'health',
  person: 'relationships',
  friend: 'relationships',
  family: 'relationships',
  expense: 'finance',
  budget: 'finance',
  money: 'finance',
  idea: 'creativity',
  art: 'creativity',
  writing: 'creativity',
  meditation: 'mindfulness',
  reflection: 'mindfulness',
  rest: 'rest',
  sleep: 'rest',
  chore: 'home',
  house: 'home',
  task: 'work',
  project: 'work',
  work: 'work',
};

export interface BalanceGaps {
  coverages: Record<Category, number>;
  gaps: Record<Category, number>;
  maxGapCategory: Category;
}

export async function computeBalanceGaps(
  adapter: StorageAdapter,
  now: number = Date.now()
): Promise<BalanceGaps> {
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const target = 3;

  // Count recent captures by category
  const nodeRows = await adapter.query<{ category: string; count: number }>(
    `SELECT category, COUNT(*) as count
     FROM node_signal
     WHERE computed_at >= ? AND category IS NOT NULL
     GROUP BY category`,
    [fourteenDaysAgo]
  );

  // Count completed reflections in last 14 days
  const reflectionRows = await adapter.query<{ category: string; count: number }>(
    `SELECT category, COUNT(*) as count
     FROM reflection
     WHERE status = 'done' AND resolved_at >= ?
     GROUP BY category`,
    [fourteenDaysAgo]
  );

  const categoryTotals: Record<Category, number> = {
    learning: 0,
    health: 0,
    relationships: 0,
    finance: 0,
    creativity: 0,
    mindfulness: 0,
    rest: 0,
    home: 0,
    work: 0,
  };

  for (const r of nodeRows) {
    if (r.category && r.category in categoryTotals) {
      categoryTotals[r.category as Category] += Number(r.count || 0);
    }
  }

  for (const r of reflectionRows) {
    if (r.category && r.category in categoryTotals) {
      categoryTotals[r.category as Category] += Number(r.count || 0);
    }
  }

  const coverages: Record<Category, number> = {} as any;
  const gaps: Record<Category, number> = {} as any;
  let maxGap = -1;
  let maxGapCategory: Category = 'health';

  for (const cat of CATEGORIES) {
    const total = categoryTotals[cat];
    const cov = Math.min(1.0, total / target);
    const gap = 1.0 - cov;
    coverages[cat] = cov;
    gaps[cat] = gap;

    if (gap > maxGap) {
      maxGap = gap;
      maxGapCategory = cat;
    }
  }

  return { coverages, gaps, maxGapCategory };
}

export function inferCategoryFromTags(tags: string[]): Category {
  for (const t of tags) {
    const clean = t.toLowerCase().replace(/^#/, '');
    if (clean in TAG_CATEGORY_MAP) {
      return TAG_CATEGORY_MAP[clean];
    }
  }
  return 'work';
}
