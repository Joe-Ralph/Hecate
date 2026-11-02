/**
 * Central Hecate Database & Repository Container
 */

import { StorageAdapter } from './adapters/storage-adapter';
import { runMigrations } from './migrator';
import { NodeRepository } from './repositories/node-repo';
import { TagRepository } from './repositories/tag-repo';
import { RefRepository } from './repositories/ref-repo';
import { SearchRepository } from './repositories/search-repo';
import { AiRepository } from './repositories/ai-repo';
import { SettingsRepository } from './repositories/settings-repo';

export class HecateDatabase {
  constructor(
    public adapter: StorageAdapter,
    public nodes: NodeRepository,
    public tags: TagRepository,
    public refs: RefRepository,
    public search: SearchRepository,
    public ai: AiRepository,
    public settings: SettingsRepository
  ) {}

  static async create(adapter: StorageAdapter): Promise<HecateDatabase> {
    await runMigrations(adapter);
    const nodes = new NodeRepository(adapter);
    const tags = new TagRepository(adapter, nodes);
    const refs = new RefRepository(adapter);
    const search = new SearchRepository(adapter, tags);
    const ai = new AiRepository(adapter);
    const settings = new SettingsRepository(adapter);

    return new HecateDatabase(adapter, nodes, tags, refs, search, ai, settings);
  }
}
