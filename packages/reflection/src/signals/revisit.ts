/**
 * S6 Unrevisited (Section 5)
 * Created > 14 days ago, content >= 80 chars or has children, and last_opened_at is null or older than 21 days.
 */

export function isUnrevisited(params: {
  createdAt: number;
  content: string;
  childCount: number;
  lastOpenedAt: number | null;
  now?: number;
}): boolean {
  const now = params.now || Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const twentyOneDaysMs = 21 * 24 * 60 * 60 * 1000;

  if (now - params.createdAt < fourteenDaysMs) {
    return false;
  }

  const hasSubstance = (params.content || '').length >= 80 || params.childCount > 0;
  if (!hasSubstance) {
    return false;
  }

  if (params.lastOpenedAt === null) {
    return true;
  }

  return now - params.lastOpenedAt > twentyOneDaysMs;
}
