import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { CoachEngine } from '../src/coach';
import { MockProvider } from '../src/providers/mock';

describe('AI Mini-Task Coach Engine', () => {
  let db: HecateDatabase;
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('rejects execution when AI is disabled (consent requirement)', async () => {
    await db.settings.updateSettings({ aiEnabled: false });
    const engine = new CoachEngine(db);
    const provider = new MockProvider();

    await expect(engine.runCoaching(provider)).rejects.toThrow(/consent required/i);
  });

  it('generates 3 to 5 valid mini-tasks when enabled', async () => {
    await db.settings.updateSettings({ aiEnabled: true });
    await db.nodes.create({ content: 'Deep Work book study notes' });

    const engine = new CoachEngine(db);
    const provider = new MockProvider();

    const result = await engine.runCoaching(provider);
    expect(result.summary.text).toBeDefined();
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
    expect(result.tasks.length).toBeLessThanOrEqual(5);

    // Verify task attributes
    const task = result.tasks[0];
    expect(task.title).toBeDefined();
    expect(task.duration_min).toBeGreaterThanOrEqual(5);
    expect(task.duration_min).toBeLessThanOrEqual(60);
    expect(task.rationale).toBeDefined();
    expect(task.status).toBe('suggested');
  });

  it('retries with repair prompt when response is malformed', async () => {
    await db.settings.updateSettings({ aiEnabled: true });
    const engine = new CoachEngine(db);
    const provider = new MockProvider();
    provider.shouldFailMalformedCount = 1; // Fails first attempt, succeeds on repair retry

    const result = await engine.runCoaching(provider);
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
  });
});
