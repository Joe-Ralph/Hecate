import { ScoredCandidate } from './score';
import { Candidate, ReflectionKind } from '../types';

function candidateSimilarity(a: Candidate, b: Candidate): number {
  if (a.kind === b.kind) return 0.6;
  if (a.category === b.category) return 0.3;
  return 0.1;
}

export interface SelectionResult {
  slots: ScoredCandidate[];
  reserve: ScoredCandidate[];
}

const DATA_KINDS: Set<ReflectionKind> = new Set([
  'seed_to_plan',
  'explore_to_plan',
  'connect',
  'revisit',
  'pattern',
  'journal',
]);

const LOOP_KINDS: Set<ReflectionKind> = new Set([
  'plan_to_start',
  'unblock',
  'close_loop',
]);

export function selectSlotsAndReserve(
  scored: ScoredCandidate[],
  options: {
    slotsCount?: number;
    reserveCount?: number;
    mmrLambda?: number;
    totalEligibleNodes?: number;
  } = {}
): SelectionResult {
  const slotsCount = options.slotsCount || 4;
  const reserveCount = options.reserveCount || 4;
  const mmrLambda = options.mmrLambda || 0.4;
  const totalEligibleNodes = options.totalEligibleNodes ?? 20;

  // Sort descending by score
  const available = [...scored].sort((a, b) => b.score - a.score);

  const picked: ScoredCandidate[] = [];
  const kindCounts = new Map<string, number>();
  const pickedSources = new Set<string>();

  const dataCandidatesCount = available.filter((c) => c.candidate.kind !== 'evergreen').length;

  const canPick = (sc: ScoredCandidate, isSlotPick: boolean): boolean => {
    const c = sc.candidate;
    const kCount = kindCounts.get(c.kind) || 0;
    
    // At most 2 per kind (except evergreen when filling up to slotsCount)
    if (c.kind !== 'evergreen' && kCount >= 2) return false;

    // At most 1 per source node
    for (const src of c.sourceNodeIds) {
      if (pickedSources.has(src)) return false;
    }

    // At most 1 evergreen while >= 3 data candidates exist (for visible slots)
    if (isSlotPick && c.kind === 'evergreen' && dataCandidatesCount >= 3) {
      const currentEvergreen = picked.filter((p) => p.candidate.kind === 'evergreen').length;
      if (currentEvergreen >= 1) return false;
    }

    return true;
  };

  const markPicked = (sc: ScoredCandidate) => {
    picked.push(sc);
    const k = sc.candidate.kind;
    kindCounts.set(k, (kindCounts.get(k) || 0) + 1);
    for (const src of sc.candidate.sourceNodeIds) {
      pickedSources.add(src);
    }
    const idx = available.indexOf(sc);
    if (idx >= 0) available.splice(idx, 1);
  };

  // Cold start (section 8.3): with under 10 eligible nodes, show 1 data and fill rest with evergreen
  if (totalEligibleNodes < 10) {
    const firstData = available.find((sc) => sc.candidate.kind !== 'evergreen' && canPick(sc, true));
    if (firstData) {
      markPicked(firstData);
    }
  } else {
    // Target composition:
    // Slot 1-2: best data
    for (let i = 0; i < 2; i++) {
      const bestData = available.find((sc) => DATA_KINDS.has(sc.candidate.kind) && canPick(sc, true));
      if (bestData) {
        markPicked(bestData);
      }
    }

    // Slot 3: best loop
    const bestLoop = available.find((sc) => LOOP_KINDS.has(sc.candidate.kind) && canPick(sc, true));
    if (bestLoop) {
      markPicked(bestLoop);
    }

    // Slot 4: evergreen or balance
    const bestBalanceOrEvergreen = available.find(
      (sc) => (sc.candidate.kind === 'evergreen' || sc.candidate.kind === 'balance') && canPick(sc, true)
    );
    if (bestBalanceOrEvergreen) {
      markPicked(bestBalanceOrEvergreen);
    }
  }

  // Fill remaining slots using MMR
  while (picked.length < slotsCount && available.length > 0) {
    let bestScore = -Infinity;
    let bestCandidate: ScoredCandidate | null = null;

    for (const sc of available) {
      if (!canPick(sc, true)) continue;

      let maxSim = 0;
      for (const p of picked) {
        const sim = candidateSimilarity(sc.candidate, p.candidate);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = sc.score - mmrLambda * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestCandidate = sc;
      }
    }

    if (bestCandidate) {
      markPicked(bestCandidate);
    } else {
      break;
    }
  }

  // Pick reserve (up to reserveCount)
  const reserve: ScoredCandidate[] = [];
  while (reserve.length < reserveCount && available.length > 0) {
    let bestSc: ScoredCandidate | null = null;
    let bestIdx = -1;

    for (let i = 0; i < available.length; i++) {
      const sc = available[i];
      if (canPick(sc, false)) {
        bestSc = sc;
        bestIdx = i;
        break;
      }
    }

    if (bestSc && bestIdx >= 0) {
      reserve.push(bestSc);
      available.splice(bestIdx, 1);
    } else {
      break;
    }
  }

  return {
    slots: picked,
    reserve,
  };
}
