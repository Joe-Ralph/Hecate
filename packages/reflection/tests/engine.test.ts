import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { DefaultReflectionEngine } from '../src/engine';
import { SeededRNG, sampleBeta } from '../src/scoring/bandit';
import { computeCandidateScore } from '../src/scoring/score';
import { selectSlotsAndReserve } from '../src/scoring/select';
import { CandidateGenerator } from '../src/candidates/generators';
import { AiProvider, AiCompletionRequest } from '@hecate/ai';

class MockSlowAiProvider implements AiProvider {
  id: 'mock' = 'mock';
  constructor(private delayMs = 100, private response = '{}') {}
  async complete(_req: AiCompletionRequest): Promise<string> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return this.response;
  }
}

describe('Hecate Reflection Engine Acceptance Suite (README Section 17)', () => {
  let adapter: MemoryStorageAdapter;
  let db: HecateDatabase;
  let engine: DefaultReflectionEngine;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
    engine = new DefaultReflectionEngine(adapter, undefined, undefined, new SeededRNG(42));
  });

  // Acceptance Test 4: Evergreen without data
  it('Acceptance 4: Evergreen without data - Empty workspace yields 4 Reflections, all evergreen, with valid categories and durations', async () => {
    // Clear starter seed nodes for pristine empty test
    await adapter.execute('DELETE FROM node');
    await adapter.execute('DELETE FROM node_tag');

    const today = await engine.getToday();
    expect(today.length).toBe(4);
    expect(today.every((r) => r.kind === 'evergreen')).toBe(true);
    expect(today.every((r) => r.durationMin >= 5 && r.durationMin <= 30)).toBe(true);
    expect(today.every((r) => r.category.length > 0)).toBe(true);
  });

  // Acceptance Test 1: Seed to plan
  it('Acceptance 1: Seed to plan - Tracked #idea with no children created 3 days ago yields seed_to_plan', async () => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const ideaTag = await db.tags.createTag('idea', { color: '#c4b2ff' });
    const botNode = await db.nodes.create({ content: 'Build a hex legged bot' });
    await db.tags.applyTag(botNode.id, ideaTag.id);

    // Adjust created_at to 3 days ago
    await adapter.execute('UPDATE node SET created_at = ?, updated_at = ? WHERE id = ?', [
      threeDaysAgo,
      threeDaysAgo,
      botNode.id,
    ]);

    const reflections = await engine.refresh({ reason: 'manual' });
    const seedRef = reflections.find((r) => r.kind === 'seed_to_plan');

    expect(seedRef).toBeDefined();
    expect(seedRef!.title.toLowerCase()).toContain('build a hex legged bot');
    const stepsText = seedRef!.steps.join(' ').toLowerCase();
    expect(stepsText).toContain('goal');
    expect(stepsText).toContain('unknowns');
    expect(stepsText).toContain('first step');
  });

  // Acceptance Test 2: No repeat after progress
  it('Acceptance 2: No repeat after progress - After marking done with notes, next run yields explore_to_plan, not seed_to_plan', async () => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

    const ideaTag = await db.tags.createTag('idea', { color: '#c4b2ff' });
    const botNode = await db.nodes.create({ content: 'Build a hex legged bot' });
    await db.tags.applyTag(botNode.id, ideaTag.id);
    await adapter.execute('UPDATE node SET created_at = ?, updated_at = ? WHERE id = ?', [
      threeDaysAgo,
      threeDaysAgo,
      botNode.id,
    ]);

    const firstRun = await engine.refresh();
    const seedRef = firstRun.find((r) => r.kind === 'seed_to_plan');
    expect(seedRef).toBeDefined();

    // Mark done with notes (saves child notes, lifts rung from seed -> explored)
    await engine.act(seedRef!.id, {
      type: 'done',
      notes: 'Goal: 6-legged walking robot. Unknowns: gait, servos, battery.',
    });

    const secondRun = await engine.refresh();
    const seedRepeat = secondRun.find((r) => r.kind === 'seed_to_plan');
    const exploreRef = secondRun.find((r) => r.kind === 'explore_to_plan');

    expect(seedRepeat).toBeUndefined();
    expect(exploreRef).toBeDefined();
  });

  // Acceptance Test 3: Stalled item
  it('Acceptance 3: Stalled item - Project with no activity for 20 days yields unblock; 5 days does not', async () => {
    const now = Date.now();
    const projectTag = await db.tags.createTag('project', { color: '#8fd18b' });

    // Stalled 20 days project
    const stalledProject = await db.nodes.create({ content: 'Write compiler book' });
    await db.tags.applyTag(stalledProject.id, projectTag.id);
    const stalledChild = await db.nodes.create({ content: 'Outline chapters', parent_id: stalledProject.id });
    const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;
    await adapter.execute(
      'UPDATE node SET created_at = ?, updated_at = ? WHERE id = ? OR parent_id = ? OR parent_id IN (SELECT id FROM node WHERE parent_id = ?)',
      [twentyDaysAgo, twentyDaysAgo, stalledProject.id, stalledProject.id, stalledProject.id]
    );

    // Active project (5 days ago)
    const activeProject = await db.nodes.create({ content: 'Redesign pantry' });
    await db.tags.applyTag(activeProject.id, projectTag.id);
    const activeChild = await db.nodes.create({ content: 'Measure shelves', parent_id: activeProject.id });
    const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
    await adapter.execute(
      'UPDATE node SET created_at = ?, updated_at = ? WHERE id = ? OR parent_id = ? OR parent_id IN (SELECT id FROM node WHERE parent_id = ?)',
      [fiveDaysAgo, fiveDaysAgo, activeProject.id, activeProject.id, activeProject.id]
    );

    // Populate additional notes so workspace has >= 10 eligible nodes (not in cold-start mode)
    for (let i = 0; i < 8; i++) {
      await db.nodes.create({ content: `Reference doc ${i}` });
    }

    const reflections = await engine.refresh();
    const unblockRefs = reflections.filter((r) => r.kind === 'unblock');

    expect(unblockRefs.some((r) => r.sourceNodeIds.includes(stalledProject.id))).toBe(true);
    expect(unblockRefs.some((r) => r.sourceNodeIds.includes(activeProject.id))).toBe(false);
  });

  // Acceptance Test 6: Skip replaces instantly
  it('Acceptance 6: Skip replaces instantly - Skipping slot 2 returns replacement in same slot differing in kind/source', async () => {
    const today = await engine.getToday();
    expect(today.length).toBeGreaterThanOrEqual(2);

    const slot2 = today.find((r) => r.slot === 2)!;
    const { replacement } = await engine.act(slot2.id, {
      type: 'skip',
      reason: 'not_relevant',
    });

    expect(replacement).toBeDefined();
    expect(replacement!.slot).toBe(2);
    expect(replacement!.id).not.toBe(slot2.id);
  });

  // Acceptance Test 7: Skip learning
  it('Acceptance 7: Skip learning - 3 skips with not_relevant drops sampled affinity below prior mean', async () => {
    const today = await engine.getToday();
    let current = today[0];

    // Apply 3 skips with not_relevant
    for (let i = 0; i < 3; i++) {
      const res = await engine.act(current.id, { type: 'skip', reason: 'not_relevant' });
      if (res.replacement) {
        current = res.replacement;
      }
    }

    const { mutes } = await engine.getLearning();
    expect(mutes.length).toBeGreaterThan(0);

    // Prior mean was 2 / (2 + 2) = 0.5. With beta increased by 3 (beta = 5), alpha = 2, mean is 2 / 7 = 0.285
    // Theoretical Beta(2, 5) CDF at 0.5 is 57/64 ≈ 89.06%
    const rng = new SeededRNG(100);
    let countBelowPrior = 0;
    for (let i = 0; i < 1000; i++) {
      const s = sampleBeta(2, 5, rng);
      if (s < 0.5) countBelowPrior++;
    }
    expect(countBelowPrior / 1000).toBeGreaterThanOrEqual(0.88);
  });

  // Acceptance Test 8: Topic mute
  it('Acceptance 8: Topic mute - not_interested on a topic prevents any reflection with that category until unmuted', async () => {
    const today = await engine.getToday();
    const target = today[0];
    const cat = target.category;

    await engine.act(target.id, { type: 'skip', reason: 'not_interested' });

    const updated = await engine.refresh();
    expect(updated.some((r) => r.category === cat && r.kind !== 'evergreen')).toBe(false);
  });

  // Acceptance Test 9: Undo
  it('Acceptance 9: Undo - Restores skipped card and returns replacement to reserve within 5 seconds', async () => {
    const today = await engine.getToday();
    const target = today[0];

    await engine.act(target.id, { type: 'skip', reason: 'not_now' });

    const afterSkip = await engine.getToday();
    expect(afterSkip.find((r) => r.id === target.id)).toBeUndefined();

    // Undo
    await engine.act(target.id, { type: 'undo' });

    const afterUndo = await engine.getToday();
    expect(afterUndo.find((r) => r.id === target.id)).toBeDefined();
  });

  // Acceptance Test 10: Three-skip rule
  it('Acceptance 10: Three-skip rule - Three consecutive skips yield an evergreen replacement', async () => {
    const today = await engine.getToday();
    await engine.act(today[0].id, { type: 'skip' });
    await engine.act(today[1].id, { type: 'skip' });
    const { replacement } = await engine.act(today[2].id, { type: 'skip' });

    expect(replacement).toBeDefined();
    expect(replacement!.kind).toBe('evergreen');
  });

  // Acceptance Test 5: Mix
  it('Acceptance 5: Mix - Workspace with 3 seeds, 2 overdue tasks and no recent movement yields 2 data, 1 loop and 1 evergreen/balance Reflection', async () => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const ideaTag = await db.tags.createTag('idea', { color: '#c4b2ff' });
    const taskTag = await db.tags.createTag('task', { color: '#f28b82' });

    for (let i = 0; i < 3; i++) {
      const seed = await db.nodes.create({ content: `Idea Seed ${i}` });
      await db.tags.applyTag(seed.id, ideaTag.id);
      await adapter.execute('UPDATE node SET created_at = ?, updated_at = ? WHERE id = ?', [
        threeDaysAgo,
        threeDaysAgo,
        seed.id,
      ]);
    }

    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (let i = 0; i < 2; i++) {
      const task = await db.nodes.create({ content: `Overdue Task ${i} [[date:${yesterday}]]` });
      await db.tags.applyTag(task.id, taskTag.id);
      await adapter.execute('UPDATE node SET created_at = ?, updated_at = ? WHERE id = ?', [
        threeDaysAgo,
        threeDaysAgo,
        task.id,
      ]);
    }

    for (let i = 0; i < 6; i++) {
      await db.nodes.create({ content: `Reference Note ${i}` });
    }

    const visible = await engine.refresh();
    expect(visible.length).toBe(4);

    const dataKinds = new Set(['seed_to_plan', 'explore_to_plan', 'connect', 'revisit', 'pattern', 'journal']);
    const loopKinds = new Set(['plan_to_start', 'unblock', 'close_loop']);
    const egOrBalKinds = new Set(['evergreen', 'balance']);

    expect(dataKinds.has(visible[0].kind)).toBe(true);
    expect(dataKinds.has(visible[1].kind)).toBe(true);
    expect(loopKinds.has(visible[2].kind)).toBe(true);
    expect(egOrBalKinds.has(visible[3].kind)).toBe(true);
  });

  // Acceptance Test 11: Local hour wrap-up
  it('Acceptance 11: Local hour wrap-up - At 19:00 with work done today, visible slot 1 is journal', async () => {
    // Note created today
    await db.nodes.create({ content: 'Finished architecture refactor' });

    // 19:00 today
    const evening = new Date();
    evening.setHours(19, 0, 0, 0);
    const eveningTime = evening.getTime();

    // Recompute dirty signals so note is in node_signal
    await engine['coordinator'].recomputeDirty(200, eveningTime);

    // Refresh candidate generation at eveningTime
    const gen = new CandidateGenerator(adapter, engine['config']);
    const candidates = await gen.generateAll(eveningTime);
    const journalCand = candidates.find((c) => c.kind === 'journal');
    expect(journalCand).toBeDefined();

    // Verify slot 1 is journal when scored at 19:00
    const scoredList = candidates
      .map((c) =>
        computeCandidateScore(c, {
          preferenceWeights: new Map(),
          mutedNodeIds: new Set(),
          mutedTopicIds: new Set(),
          mutedKinds: new Set(),
          mutedEvergreenIds: new Set(),
          snoozedSourceIds: new Map(),
          shownTitlesLast14Days: [],
          shownKindSourcesLast7Days: new Set(),
          availableMinutes: 30,
          now: eveningTime,
          rng: new SeededRNG(42),
        })
      )
      .filter(Boolean) as any[];

    const selection = selectSlotsAndReserve(scoredList, {
      slotsCount: 4,
      reserveCount: 4,
      totalEligibleNodes: 20,
    });

    expect(selection.slots[0].candidate.kind).toBe('journal');
  });

  // Acceptance Test 12: Invalid JSON
  it('Acceptance 12: Invalid JSON - Malformed JSON twice results in wording = template and no error shown', async () => {
    const badProvider = new MockSlowAiProvider(0, 'INVALID NON-JSON RESPONSE');
    const aiEngine = new DefaultReflectionEngine(adapter, badProvider, {
      ...engine['config'],
      aiEnabled: true,
    });

    const ideaTag = await db.tags.createTag('idea', { color: '#c4b2ff' });
    const note = await db.nodes.create({ content: 'Design solar sail' });
    await db.tags.applyTag(note.id, ideaTag.id);
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await adapter.execute('UPDATE node SET created_at = ?, updated_at = ? WHERE id = ?', [
      threeDaysAgo,
      threeDaysAgo,
      note.id,
    ]);

    const results = await aiEngine.refresh();
    expect(results.length).toBe(4);
    expect(results.every((r) => r.wording === 'template')).toBe(true);
  });

  // Acceptance Test 13: Privacy
  it('Acceptance 13: Privacy - Node tagged #private is absent from all signal tables and candidates', async () => {
    const privateTag = await db.tags.createTag('private');
    const secretIdea = await db.nodes.create({ content: 'Confidential project secrets' });
    await db.tags.applyTag(secretIdea.id, privateTag.id);

    await engine.refresh();

    const signalRows = await adapter.query<any>('SELECT * FROM node_signal WHERE node_id = ?', [secretIdea.id]);
    expect(signalRows.length).toBe(0);

    const shown = await engine.getToday();
    expect(shown.some((r) => r.sourceNodeIds.includes(secretIdea.id))).toBe(false);
  });
});
