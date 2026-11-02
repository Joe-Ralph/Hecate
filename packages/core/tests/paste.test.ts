import { describe, it, expect } from 'vitest';
import { parseTanaPaste, serializeTanaPaste, isTanaPaste } from '../src/paste';

describe('Tana Paste Parser & Serializer', () => {
  const sampleTana = `%%tana%%
- Read Deep Work #book
  - Author:: Cal Newport
  - Status:: Reading
  - Rating:: 4
- Call [[Maya]] about the trip
  - Due:: [[date:2026-11-10]]`;

  it('detects Tana Paste format', () => {
    expect(isTanaPaste(sampleTana)).toBe(true);
    expect(isTanaPaste('plain single line with nothing')).toBe(false);
  });

  it('parses hierarchy, tags, fields and dates correctly', () => {
    const parsed = parseTanaPaste(sampleTana);
    expect(parsed.length).toBe(2);

    // First node
    const n1 = parsed[0];
    expect(n1.content).toBe('Read Deep Work');
    expect(n1.tags).toEqual(['book']);
    expect(n1.fields).toEqual([
      { name: 'Author', value: 'Cal Newport' },
      { name: 'Status', value: 'Reading' },
      { name: 'Rating', value: '4' },
    ]);

    // Second node
    const n2 = parsed[1];
    expect(n2.content).toBe('Call [[Maya]] about the trip');
    expect(n2.tags).toEqual([]);
    expect(n2.fields).toEqual([
      { name: 'Due', value: '[[date:2026-11-10]]' },
    ]);
  });

  it('round-trips serialize and parse', () => {
    const nodes = [
      {
        content: 'Read Deep Work',
        tags: ['book'],
        fields: [
          { name: 'Author', value: 'Cal Newport' },
          { name: 'Status', value: 'Reading' },
          { name: 'Rating', value: '4' },
        ],
        children: [],
      },
      {
        content: 'Call [[Maya]] about the trip',
        fields: [{ name: 'Due', value: '[[date:2026-11-10]]' }],
        children: [],
      },
    ];

    const serialized = serializeTanaPaste(nodes);
    const reparsed = parseTanaPaste(serialized);

    expect(reparsed.length).toBe(2);
    expect(reparsed[0].content).toBe('Read Deep Work');
    expect(reparsed[0].tags).toEqual(['book']);
    expect(reparsed[0].fields.length).toBe(3);
    expect(reparsed[1].content).toBe('Call [[Maya]] about the trip');
    expect(reparsed[1].fields[0].value).toBe('[[date:2026-11-10]]');
  });

  it('parses checkboxes [ ] and [x]', () => {
    const text = `%%tana%%
- [ ] Task incomplete #task
- [x] Task complete #task`;
    const parsed = parseTanaPaste(text);
    expect(parsed.length).toBe(2);
    expect(parsed[0].isDone).toBe(false);
    expect(parsed[0].content).toBe('Task incomplete');
    expect(parsed[1].isDone).toBe(true);
    expect(parsed[1].content).toBe('Task complete');
  });
});
