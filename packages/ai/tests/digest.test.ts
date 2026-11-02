import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '@hecate/storage';
import { HecateDatabase } from '@hecate/storage';
import { buildKnowledgeDigest, sanitizeText } from '../src/digest';

describe('AI Knowledge Digest Builder & Sanitizer', () => {
  let db: HecateDatabase;
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('sanitizes emails, phone numbers, and URL query strings', () => {
    const raw = 'Contact maya@example.com or call +1 (555) 234-5678. See https://hecate.pkm/notes?secret=12345';
    const clean = sanitizeText(raw);
    expect(clean).toContain('[email]');
    expect(clean).toContain('[phone]');
    expect(clean).toContain('https://hecate.pkm/notes');
    expect(clean).not.toContain('secret=12345');
    expect(clean).not.toContain('maya@example.com');
  });

  it('excludes nodes tagged #private', async () => {
    const privateTag = await db.tags.getTagByName('private');
    expect(privateTag).toBeDefined();

    const normalNode = await db.nodes.create({ content: 'Public reflection notes' });
    const privateNode = await db.nodes.create({ content: 'Top secret diary entry' });
    await db.tags.applyTag(privateNode.id, privateTag!.id);

    const payload = await buildKnowledgeDigest(db, 7);
    const allTexts = payload.digest.map((d) => d.text);

    expect(allTexts).toContain('Public reflection notes');
    expect(allTexts).not.toContain('Top secret diary entry');
  });

  it('excludes nodes flagged with meta.aiExclude = true', async () => {
    await db.nodes.create({
      content: 'Explicitly excluded thought',
      meta: { aiExclude: true },
    });

    const payload = await buildKnowledgeDigest(db, 7);
    const allTexts = payload.digest.map((d) => d.text);
    expect(allTexts).not.toContain('Explicitly excluded thought');
  });
});
