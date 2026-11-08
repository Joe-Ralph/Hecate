/**
 * S9 Importance (Section 5)
 * 0..1 from: pinned (+0.3), log-scaled ref_count (up to +0.3), Priority field High (+0.2), created in last 7 days (+0.2)
 */

export function computeImportance(params: {
  isPinned: boolean;
  refCount: number;
  priority?: string;
  createdAt: number;
  now?: number;
}): number {
  const now = params.now || Date.now();
  let score = 0;

  if (params.isPinned) {
    score += 0.3;
  }

  if (params.refCount > 0) {
    // log10(refCount + 1) normalized up to 0.3 (caps around 10 refs)
    const refBonus = Math.min(0.3, Math.log10(params.refCount + 1) * 0.3);
    score += refBonus;
  }

  const p = (params.priority || '').toLowerCase();
  if (p === 'high' || p === 'urgent' || p === 'p1') {
    score += 0.2;
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (now - params.createdAt < sevenDaysMs) {
    score += 0.2;
  }

  return Math.min(1.0, Math.max(0.0, score));
}
