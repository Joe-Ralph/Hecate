/**
 * S2 Staleness (Section 5)
 * days = (now - last_activity_at) / (86400000), where last_activity_at is max(updated_at) over node and descendants.
 */

export function computeStalenessDays(now: number, lastActivityAt: number): number {
  if (!lastActivityAt || lastActivityAt <= 0) return 0;
  const diffMs = Math.max(0, now - lastActivityAt);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
