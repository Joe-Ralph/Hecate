import { StorageAdapter } from '@hecate/storage';
import { generateUlid } from '@hecate/core';
import { AiProvider } from '@hecate/ai';
import {
  ReflectionEngine,
  Reflection,
  UserAction,
  Rollup,
  Mute,
  KindStats,
  ReflectionKind,
  Candidate,
} from './types';
import { EngineConfig, DEFAULT_CONFIG } from './config';
import { SignalCoordinator } from './signals/coordinator';
import { CandidateGenerator } from './candidates/generators';
import { computeCandidateScore, ScoreContext, ScoredCandidate } from './scoring/score';
import { selectSlotsAndReserve } from './scoring/select';
import { generateTemplateWording } from './wording/templates';
import { generateWording } from './wording/prompts';
import { MuteManager } from './feedback/mutes';
import { EventLogger } from './feedback/events';
import { PreferenceLearner } from './feedback/learn';
import { RollupBuilder } from './rollups/build';
import { SeededRNG } from './scoring/bandit';
import { EVERGREEN_LIBRARY, filterEvergreenLibrary } from './evergreen/library';

export interface EngineUndoState {
  skippedReflection: Reflection;
  replacementReflection: Reflection;
  learningDelta?: { deltaAlpha: number; deltaBeta: number; keys: any };
  addedMuteId?: string;
  timestamp: number;
}

export class DefaultReflectionEngine implements ReflectionEngine {
  private coordinator: SignalCoordinator;
  private candidateGen: CandidateGenerator;
  private mutes: MuteManager;
  private events: EventLogger;
  private learner: PreferenceLearner;
  private rollupBuilder: RollupBuilder;

  private listeners = new Map<string, Set<(p: any) => void>>();
  private undoStack: EngineUndoState[] = [];
  private consecutiveSkipsToday = 0;

  private config: EngineConfig;

  constructor(
    private adapter: StorageAdapter,
    private provider?: AiProvider,
    config: Partial<EngineConfig> = {},
    private rng: SeededRNG = new SeededRNG()
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.coordinator = new SignalCoordinator(adapter, this.config);
    this.candidateGen = new CandidateGenerator(adapter, this.config);
    this.mutes = new MuteManager(adapter);
    this.events = new EventLogger(adapter);
    this.learner = new PreferenceLearner(adapter);
    this.rollupBuilder = new RollupBuilder(adapter);
  }

  on(event: 'changed' | 'wording-upgraded' | 'run-failed', cb: (p: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, payload?: any) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(payload);
        } catch {}
      }
    }
  }

  markNodeDirty(nodeId: string): void {
    this.coordinator.markDirty(nodeId).catch(() => {});
  }

  markNodeOpened(nodeId: string): void {
    this.coordinator.markOpened(nodeId).catch(() => {});
  }

  async getToday(): Promise<Reflection[]> {
    const rows = await this.adapter.query<any>(
      `SELECT * FROM reflection
       WHERE status IN ('shown', 'started') AND slot IS NOT NULL
       ORDER BY slot ASC`
    );

    if (rows.length === 0) {
      return this.refresh({ reason: 'open' });
    }

    return rows.map((r) => this.parseReflection(r));
  }

  async refresh(opts: { reason?: 'open' | 'manual' | 'settings' } = {}): Promise<Reflection[]> {
    const now = Date.now();
    const runId = generateUlid();

    // 1. Recompute dirty signals
    await this.coordinator.recomputeDirty(200, now);

    // 2. Generate candidates
    const candidates = await this.candidateGen.generateAll(now);

    // 3. Build ScoreContext
    const activeMutes = await this.mutes.getActiveMutes(now);
    const mutedNodeIds = new Set(activeMutes.filter((m) => m.scope === 'node').map((m) => m.target_id));
    const mutedTopicIds = new Set(activeMutes.filter((m) => m.scope === 'topic').map((m) => m.target_id));
    const mutedKinds = new Set(activeMutes.filter((m) => m.scope === 'kind').map((m) => m.target_id));
    const mutedEvergreenIds = new Set(activeMutes.filter((m) => m.scope === 'evergreen').map((m) => m.target_id));

    const weights = await this.learner.getAllWeights();

    // Shown titles last 14 days
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const prevShown = await this.adapter.query<{ title: string; kind: string; source_node_ids: string }>(
      'SELECT title, kind, source_node_ids FROM reflection WHERE created_at >= ?',
      [fourteenDaysAgo]
    );
    const shownTitlesLast14Days = prevShown.map((p) => p.title);

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const shownKindSourcesLast7Days = new Set<string>();
    for (const p of prevShown) {
      if (p.source_node_ids) {
        try {
          const sIds = JSON.parse(p.source_node_ids);
          for (const s of sIds) {
            shownKindSourcesLast7Days.add(`${p.kind}:${s}`);
          }
        } catch {}
      }
    }

    const scoreCtx: ScoreContext = {
      preferenceWeights: weights,
      mutedNodeIds,
      mutedTopicIds,
      mutedKinds,
      mutedEvergreenIds,
      snoozedSourceIds: new Map(),
      shownTitlesLast14Days,
      shownKindSourcesLast7Days,
      availableMinutes: this.config.maxDurationMin,
      now,
      rng: this.rng,
    };

    // 4. Score all candidates
    const scoredList: ScoredCandidate[] = [];
    for (const c of candidates) {
      const sc = computeCandidateScore(c, scoreCtx);
      if (sc) scoredList.push(sc);
    }

    // Total eligible nodes
    const eligibleCountRow = await this.adapter.query<{ count: number }>(
      'SELECT count(*) as count FROM node_signal'
    );
    const totalEligible = Number(eligibleCountRow[0]?.count || 0);

    // 5. Select slots and reserve using MMR
    const selection = selectSlotsAndReserve(scoredList, {
      slotsCount: this.config.slots,
      reserveCount: this.config.reserve,
      mmrLambda: this.config.mmrLambda,
      totalEligibleNodes: totalEligible,
    });

    // 6. Expire previous unresolved reflections
    await this.adapter.execute(
      "UPDATE reflection SET status = 'expired' WHERE status IN ('shown', 'queued') AND slot IS NOT NULL"
    );

    // 7. Insert new slots and reserve
    const visibleReflections: Reflection[] = [];

    // Visible slots (1 to 4)
    for (let i = 0; i < selection.slots.length; i++) {
      const sc = selection.slots[i];
      const wording = generateTemplateWording(sc.candidate);
      const rId = generateUlid();

      const ref: Reflection = {
        id: rId,
        kind: sc.candidate.kind,
        status: 'shown',
        slot: i + 1,
        title: wording.title,
        rationale: wording.rationale,
        steps: wording.steps,
        category: sc.candidate.category,
        durationMin: sc.candidate.durationMin,
        sourceNodeIds: sc.candidate.sourceNodeIds,
        evergreenId: sc.candidate.evergreenId,
        wording: 'template',
        score: sc.score,
        scoreBreakdown: sc.breakdown,
        createdAt: now,
        shownAt: now,
      };

      await this.insertReflection(ref, runId);
      await this.events.logEvent({ reflectionId: rId, type: 'shown', now });
      visibleReflections.push(ref);
    }

    // Reserve slots (slot = null, status = 'queued')
    for (let i = 0; i < selection.reserve.length; i++) {
      const sc = selection.reserve[i];
      const wording = generateTemplateWording(sc.candidate);
      const rId = generateUlid();

      const ref: Reflection = {
        id: rId,
        kind: sc.candidate.kind,
        status: 'queued',
        slot: null,
        title: wording.title,
        rationale: wording.rationale,
        steps: wording.steps,
        category: sc.candidate.category,
        durationMin: sc.candidate.durationMin,
        sourceNodeIds: sc.candidate.sourceNodeIds,
        evergreenId: sc.candidate.evergreenId,
        wording: 'template',
        score: sc.score,
        scoreBreakdown: sc.breakdown,
        createdAt: now,
      };

      await this.insertReflection(ref, runId);
    }

    // 8. Background wording upgrade (Section 9.2) if AI is available
    if (this.provider && this.config.aiEnabled) {
      this.upgradeWordingInBackground(visibleReflections, selection.slots.map((s) => s.candidate));
    }

    this.emit('changed');
    return visibleReflections;
  }

  private async upgradeWordingInBackground(reflections: Reflection[], candidates: Candidate[]) {
    for (let i = 0; i < Math.min(reflections.length, candidates.length); i++) {
      const ref = reflections[i];
      const cand = candidates[i];
      if (cand.kind === 'evergreen') continue;

      try {
        const { result, wording } = await generateWording(cand, this.provider);
        if (wording === 'llm') {
          await this.adapter.execute(
            `UPDATE reflection SET title = ?, rationale = ?, steps = ?, wording = 'llm' WHERE id = ? AND status = 'shown'`,
            [result.title, result.rationale, JSON.stringify(result.steps), ref.id]
          );
          this.emit('wording-upgraded', { id: ref.id });
        }
      } catch {}
    }
  }

  private async insertReflection(ref: Reflection, runId: string) {
    await this.adapter.execute(
      `INSERT INTO reflection (
        id, kind, status, slot, title, rationale, steps, category, duration_min,
        source_node_ids, evergreen_id, score, score_breakdown, wording, run_id,
        created_at, shown_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ref.id,
        ref.kind,
        ref.status,
        ref.slot,
        ref.title,
        ref.rationale,
        JSON.stringify(ref.steps),
        ref.category,
        ref.durationMin,
        JSON.stringify(ref.sourceNodeIds),
        ref.evergreenId || null,
        ref.score,
        JSON.stringify(ref.scoreBreakdown || {}),
        ref.wording,
        runId,
        ref.createdAt || Date.now(),
        ref.shownAt || null,
      ]
    );
  }

  async act(id: string, action: UserAction): Promise<{ replacement?: Reflection; undoToken?: string }> {
    const now = Date.now();
    const rows = await this.adapter.query<any>('SELECT * FROM reflection WHERE id = ?', [id]);
    if (rows.length === 0) return {};

    const current = this.parseReflection(rows[0]);
    const currentSlot = current.slot;

    // Build keys for feedback
    const primaryTag = current.sourceNodeIds[0] ? '#idea' : undefined;
    const kindKey = `kind:${current.kind}`;
    const kindTagKey = primaryTag ? `kind_tag:${current.kind}|${primaryTag}` : undefined;
    const categoryKey = `category:${current.category}`;

    if (action.type === 'start') {
      await this.adapter.execute("UPDATE reflection SET status = 'started' WHERE id = ?", [id]);
      await this.events.logEvent({ reflectionId: id, type: 'start', now });
      this.emit('changed');
      return {};
    }

    if (action.type === 'done') {
      await this.adapter.execute(
        "UPDATE reflection SET status = 'done', resolved_at = ? WHERE id = ?",
        [now, id]
      );
      await this.events.logEvent({
        reflectionId: id,
        type: 'done',
        payload: { notes: action.notes },
        now,
      });

      // Apply learning update
      await this.learner.applyDone({ kindKey, kindTagKey, categoryKey }, now);

      // If notes provided or save requested, create child note under source node
      if (action.notes && current.sourceNodeIds[0]) {
        await this.adapter.execute(
          `INSERT INTO node (id, parent_id, position, kind, content, created_at, updated_at)
           VALUES (?, ?, 'a0', 'note', ?, ?, ?)`,
          [generateUlid(), current.sourceNodeIds[0], action.notes, now, now]
        );
      }

      // Mark source node dirty to recalculate maturity rung
      if (current.sourceNodeIds[0]) {
        this.coordinator.markDirty(current.sourceNodeIds[0]);
      }

      this.consecutiveSkipsToday = 0;
      this.emit('changed');
      return {};
    }

    if (action.type === 'skip') {
      this.consecutiveSkipsToday++;

      // 1. Mark card skipped
      await this.adapter.execute(
        "UPDATE reflection SET status = 'skipped', resolved_at = ?, skip_reason = ? WHERE id = ?",
        [now, action.reason || null, id]
      );
      await this.events.logEvent({
        reflectionId: id,
        type: 'skip',
        reason: action.reason,
        now,
      });

      // 2. Apply learning update
      const learningDelta = await this.learner.applySkip(
        { kindKey, kindTagKey, categoryKey },
        action.reason,
        now
      );

      // 3. Apply mutes based on reason
      let addedMuteId: string | undefined;
      const targetId = current.sourceNodeIds[0] || current.evergreenId;
      const scope = current.sourceNodeIds[0] ? 'node' : 'evergreen';

      if (action.reason === 'not_relevant' && targetId) {
        addedMuteId = await this.mutes.addMute({
          scope,
          targetId,
          until: now + (this.config.skipMuteNodeDays || 30) * 24 * 60 * 60 * 1000,
          reason: 'skip_not_relevant',
          now,
        });
      } else if (action.reason === 'not_interested') {
        addedMuteId = await this.mutes.addMute({
          scope: 'topic',
          targetId: current.category,
          until: null,
          reason: 'skip_not_interested',
          now,
        });
      } else if (!action.reason && targetId) {
        addedMuteId = await this.mutes.addMute({
          scope,
          targetId,
          until: now + 14 * 24 * 60 * 60 * 1000,
          reason: 'skip_no_reason',
          now,
        });
      }

      // 4. Promote best replacement from reserve into slot
      const replacement = await this.promoteReplacement(current, currentSlot, now);

      // 5. Store undo state
      const undoToken = generateUlid();
      if (replacement) {
        this.undoStack.push({
          skippedReflection: current,
          replacementReflection: replacement,
          learningDelta: { ...learningDelta, keys: { kindKey, kindTagKey, categoryKey } },
          addedMuteId,
          timestamp: now,
        });
      }

      this.emit('changed');
      return { replacement, undoToken };
    }

    if (action.type === 'undo') {
      const lastUndo = this.undoStack.pop();
      if (lastUndo && now - lastUndo.timestamp <= 5000) {
        // Restore skipped card
        await this.adapter.execute(
          `UPDATE reflection SET status = 'shown', resolved_at = NULL, skip_reason = NULL, slot = ? WHERE id = ?`,
          [lastUndo.skippedReflection.slot, lastUndo.skippedReflection.id]
        );

        // Return replacement to reserve
        await this.adapter.execute(
          `UPDATE reflection SET status = 'queued', slot = NULL WHERE id = ?`,
          [lastUndo.replacementReflection.id]
        );

        // Reverse learning delta
        if (lastUndo.learningDelta) {
          const { deltaAlpha, deltaBeta, keys } = lastUndo.learningDelta;
          await this.learner.adjustWeight(keys.kindKey, -deltaAlpha, -deltaBeta, now);
          if (keys.kindTagKey) {
            await this.learner.adjustWeight(keys.kindTagKey, -deltaAlpha, -deltaBeta, now);
          }
        }

        // Remove mute if added
        if (lastUndo.addedMuteId) {
          await this.mutes.unmute(lastUndo.addedMuteId);
        }

        await this.events.logEvent({
          reflectionId: lastUndo.skippedReflection.id,
          type: 'undo',
          now,
        });

        this.emit('changed');
        return { replacement: lastUndo.skippedReflection };
      }
      return {};
    }

    if (action.type === 'snooze') {
      await this.adapter.execute(
        "UPDATE reflection SET status = 'snoozed', snoozed_until = ?, slot = NULL WHERE id = ?",
        [action.until, id]
      );
      await this.events.logEvent({ reflectionId: id, type: 'snooze', now });
      await this.learner.adjustWeight(kindKey, 0, 0.1, now);

      const replacement = await this.promoteReplacement(current, currentSlot, now);
      this.emit('changed');
      return { replacement };
    }

    if (action.type === 'save_as_node') {
      const sourceId = current.sourceNodeIds[0];
      const createdId = generateUlid();
      await this.adapter.execute(
        `INSERT INTO node (id, parent_id, position, kind, content, created_at, updated_at)
         VALUES (?, ?, 'a0', 'note', ?, ?, ?)`,
        [createdId, sourceId || null, current.title, now, now]
      );
      await this.adapter.execute('UPDATE reflection SET saved_node_id = ? WHERE id = ?', [createdId, id]);
      await this.events.logEvent({ reflectionId: id, type: 'save', now });
      this.emit('changed');
      return {};
    }

    return {};
  }

  private async promoteReplacement(
    skipped: Reflection,
    slot: number | null,
    now: number
  ): Promise<Reflection | undefined> {
    if (slot === null) return undefined;

    // Fetch reserve candidates from DB
    const reserveRows = await this.adapter.query<any>(
      "SELECT * FROM reflection WHERE status = 'queued' AND slot IS NULL ORDER BY score DESC"
    );

    const activeMutes = await this.mutes.getActiveMutes(now);
    const mutedNodes = new Set(activeMutes.filter((m) => m.scope === 'node').map((m) => m.target_id));
    const mutedTopics = new Set(activeMutes.filter((m) => m.scope === 'topic').map((m) => m.target_id));
    const mutedKinds = new Set(activeMutes.filter((m) => m.scope === 'kind').map((m) => m.target_id));
    const mutedEvergreens = new Set(activeMutes.filter((m) => m.scope === 'evergreen').map((m) => m.target_id));

    // Filter out rows violating mutes
    const validReserveRows = reserveRows.filter((r) => {
      if (mutedKinds.has(r.kind)) return false;
      if (r.category && mutedTopics.has(r.category)) return false;
      if (r.evergreen_id && mutedEvergreens.has(r.evergreen_id)) return false;
      const sIds = r.source_node_ids ? JSON.parse(r.source_node_ids) : [];
      for (const s of sIds) {
        if (mutedNodes.has(s) || mutedTopics.has(s)) return false;
      }
      return true;
    });

    let bestRow = validReserveRows.find((r) => {
      // Must differ in both kind and source if possible
      const sIds = r.source_node_ids ? JSON.parse(r.source_node_ids) : [];
      const skippedSource = skipped.sourceNodeIds[0];
      const diffKind = r.kind !== skipped.kind;
      const diffSource = !skippedSource || !sIds.includes(skippedSource);
      return diffKind && diffSource;
    });

    if (!bestRow) {
      // Differ in kind or source
      bestRow = validReserveRows.find((r) => {
        const sIds = r.source_node_ids ? JSON.parse(r.source_node_ids) : [];
        const skippedSource = skipped.sourceNodeIds[0];
        return r.kind !== skipped.kind || (!skippedSource || !sIds.includes(skippedSource));
      });
    }

    if (!bestRow && validReserveRows.length > 0) {
      bestRow = validReserveRows[0];
    }

    // Three skips in a row rule (Section 11): 3rd replacement is evergreen
    let replacementRef: Reflection;

    if (this.consecutiveSkipsToday >= 3 || !bestRow) {
      const availableEvergreens = filterEvergreenLibrary(EVERGREEN_LIBRARY, { now }).filter(
        (eg) => !mutedTopics.has(eg.category) && !mutedEvergreens.has(eg.id)
      );
      const evergreen = availableEvergreens[0] || filterEvergreenLibrary(EVERGREEN_LIBRARY, { now })[0];
      const rId = generateUlid();
      replacementRef = {
        id: rId,
        kind: 'evergreen',
        status: 'shown',
        slot,
        title: evergreen.title,
        rationale: 'A daily practice for your well-being.',
        steps: evergreen.steps,
        category: evergreen.category,
        durationMin: evergreen.durationMin,
        sourceNodeIds: [],
        evergreenId: evergreen.id,
        wording: 'template',
        score: 0.5,
        createdAt: now,
        shownAt: now,
      };
      await this.insertReflection(replacementRef, 'replacement');
    } else {
      await this.adapter.execute(
        "UPDATE reflection SET status = 'shown', slot = ?, shown_at = ? WHERE id = ?",
        [slot, now, bestRow.id]
      );
      bestRow.status = 'shown';
      bestRow.slot = slot;
      bestRow.shown_at = now;
      replacementRef = this.parseReflection(bestRow);
    }

    await this.events.logEvent({ reflectionId: replacementRef.id, type: 'shown', now });
    return replacementRef;
  }

  async explain(id: string): Promise<{ breakdown: Record<string, number>; sources: string[]; sent?: unknown }> {
    const rows = await this.adapter.query<any>('SELECT * FROM reflection WHERE id = ?', [id]);
    if (rows.length === 0) {
      return { breakdown: {}, sources: [] };
    }
    const r = rows[0];
    const breakdown = r.score_breakdown ? JSON.parse(r.score_breakdown) : {};
    const sources = r.source_node_ids ? JSON.parse(r.source_node_ids) : [];
    return { breakdown, sources };
  }

  async getRollups(period: 'day' | 'week' | 'month'): Promise<Rollup[]> {
    if (period === 'day') {
      await this.rollupBuilder.buildDailyRollup();
    } else if (period === 'week') {
      await this.rollupBuilder.buildWeeklyRollup(this.provider);
    }
    return this.rollupBuilder.getRollups(period);
  }

  async getLearning(): Promise<{ mutes: Mute[]; stats: KindStats[] }> {
    const mutes = await this.mutes.getActiveMutes();

    const kinds: ReflectionKind[] = [
      'seed_to_plan',
      'explore_to_plan',
      'plan_to_start',
      'unblock',
      'close_loop',
      'connect',
      'revisit',
      'pattern',
      'balance',
      'journal',
      'evergreen',
    ];

    const stats: KindStats[] = [];
    for (const k of kinds) {
      const shownRows = await this.adapter.query<{ count: number }>(
        'SELECT count(*) as count FROM reflection WHERE kind = ?',
        [k]
      );
      const doneRows = await this.adapter.query<{ count: number }>(
        "SELECT count(*) as count FROM reflection WHERE kind = ? AND status = 'done'",
        [k]
      );
      const skipRows = await this.adapter.query<{ count: number }>(
        "SELECT count(*) as count FROM reflection WHERE kind = ? AND status = 'skipped'",
        [k]
      );

      const shownCount = Number(shownRows[0]?.count || 0);
      const doneCount = Number(doneRows[0]?.count || 0);
      const skipCount = Number(skipRows[0]?.count || 0);
      const doneRate = shownCount > 0 ? doneCount / shownCount : 0;

      stats.push({
        kind: k,
        shownCount,
        doneCount,
        skipCount,
        doneRate,
      });
    }

    return { mutes, stats };
  }

  async unmute(muteId: string): Promise<void> {
    await this.mutes.unmute(muteId);
    this.emit('changed');
  }

  async resetLearning(): Promise<void> {
    await this.learner.resetAll();
    await this.mutes.resetAll();
    await this.adapter.execute('DELETE FROM reflection_event');
    this.emit('changed');
  }

  private parseReflection(row: any): Reflection {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      slot: row.slot !== null ? Number(row.slot) : null,
      title: row.title,
      rationale: row.rationale,
      steps: row.steps ? JSON.parse(row.steps) : [],
      category: row.category,
      durationMin: Number(row.duration_min),
      sourceNodeIds: row.source_node_ids ? JSON.parse(row.source_node_ids) : [],
      evergreenId: row.evergreen_id || undefined,
      wording: row.wording || 'template',
      score: Number(row.score),
      scoreBreakdown: row.score_breakdown ? JSON.parse(row.score_breakdown) : undefined,
      createdAt: row.created_at ? Number(row.created_at) : undefined,
      shownAt: row.shown_at ? Number(row.shown_at) : undefined,
      resolvedAt: row.resolved_at ? Number(row.resolved_at) : undefined,
      snoozedUntil: row.snoozed_until ? Number(row.snoozed_until) : undefined,
      skipReason: row.skip_reason || undefined,
      savedNodeId: row.saved_node_id || undefined,
    };
  }
}
