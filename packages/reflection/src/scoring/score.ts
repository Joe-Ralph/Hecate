import { Candidate } from '../types';
import { sampleBeta, SeededRNG } from './bandit';

export interface ScoreContext {
  preferenceWeights: Map<string, { alpha: number; beta: number }>;
  mutedNodeIds: Set<string>;
  mutedTopicIds: Set<string>;
  mutedKinds: Set<string>;
  mutedEvergreenIds: Set<string>;
  snoozedSourceIds: Map<string, number>; // sourceNodeId -> snoozedUntil
  shownTitlesLast14Days: string[];
  shownKindSourcesLast7Days: Set<string>; // `${kind}:${sourceNodeId}`
  availableMinutes: number;
  now: number;
  rng?: SeededRNG;
}

export interface ScoredCandidate {
  candidate: Candidate;
  score: number;
  breakdown: Record<string, number>;
}

function tokenSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function computeCandidateScore(
  candidate: Candidate,
  ctx: ScoreContext
): ScoredCandidate | null {
  // 1. Penalties / Exclusions
  if (ctx.mutedKinds.has(candidate.kind)) {
    return null;
  }

  if (candidate.category && ctx.mutedTopicIds.has(candidate.category)) {
    return null;
  }

  if (candidate.evergreenId && ctx.mutedEvergreenIds.has(candidate.evergreenId)) {
    return null;
  }

  for (const src of candidate.sourceNodeIds) {
    if (ctx.mutedNodeIds.has(src) || ctx.mutedTopicIds.has(src)) return null;

    const snoozedUntil = ctx.snoozedSourceIds.get(src);
    if (snoozedUntil && snoozedUntil > ctx.now) {
      return null;
    }

    const key = `${candidate.kind}:${src}`;
    if (ctx.shownKindSourcesLast7Days.has(key)) {
      return null; // Don't repeat same kind and source within 7 days
    }
  }

  // 2. Maturity Gap (0..1)
  let maturityGap = 0.4;
  if (candidate.baseScoreHints?.maturityGap !== undefined) {
    maturityGap = candidate.baseScoreHints.maturityGap;
  } else if (candidate.kind === 'seed_to_plan') {
    maturityGap = 1.0;
  } else if (candidate.kind === 'explore_to_plan') {
    maturityGap = 0.7;
  } else if (candidate.kind === 'plan_to_start') {
    maturityGap = 0.4;
  } else if (candidate.kind === 'pattern') {
    maturityGap = 0.6;
  } else if (candidate.kind === 'connect') {
    maturityGap = 0.5;
  } else if (candidate.kind === 'revisit') {
    maturityGap = 0.4;
  }

  // 3. Staleness (0..1)
  const ageDays = Number(candidate.facts?.ageDays || candidate.facts?.daysStale || candidate.facts?.daysInactive || 0);
  let staleness = 0;
  if (ageDays >= 3) {
    staleness = Math.min(1.0, ageDays / 30);
  }

  // 4. Affinity (Thompson Sample)
  const rng = ctx.rng || new SeededRNG();

  // Look for kind_tag, then kind
  const tag = candidate.facts?.tags?.[0];
  const kindTagKey = tag ? `kind_tag:${candidate.kind}|${tag}` : null;
  const kindKey = `kind:${candidate.kind}`;
  const catKey = `category:${candidate.category}`;
  const egKey = candidate.evergreenId ? `evergreen:${candidate.evergreenId}` : null;

  const getWeight = (k: string | null) => {
    if (!k) return { alpha: 2, beta: 2 };
    return ctx.preferenceWeights.get(k) || { alpha: 2, beta: 2 };
  };

  const primaryKey = egKey || kindTagKey || kindKey;
  const primaryWeight = getWeight(primaryKey);
  const catWeight = getWeight(catKey);

  const samplePrimary = sampleBeta(primaryWeight.alpha, primaryWeight.beta, rng);
  const sampleCat = sampleBeta(catWeight.alpha, catWeight.beta, rng);
  const affinity = 0.5 * samplePrimary + 0.5 * sampleCat;

  // 5. Importance (0..1)
  const importance = candidate.baseScoreHints?.importance ?? 0.5;

  // 6. Novelty (0..1)
  let maxSim = 0;
  const candTitle = String(candidate.facts?.title || candidate.kind);
  for (const prevTitle of ctx.shownTitlesLast14Days) {
    const sim = tokenSimilarity(candTitle, prevTitle);
    if (sim > maxSim) maxSim = sim;
  }
  const novelty = Math.max(0.0, 1.0 - maxSim);

  // 7. Time Fit (0..1)
  let timeFit = 1.0;
  if (candidate.durationMin > ctx.availableMinutes) {
    timeFit = 0.3;
  }

  // 8. Total Score
  const score =
    0.3 * maturityGap +
    0.2 * staleness +
    0.2 * affinity +
    0.1 * importance +
    0.1 * novelty +
    0.1 * timeFit;

  const breakdown: Record<string, number> = {
    maturityGap,
    staleness,
    affinity,
    importance,
    novelty,
    timeFit,
  };

  return {
    candidate,
    score: Math.max(0.0, score),
    breakdown,
  };
}
