import { describe, it, expect } from 'vitest';
import {
  wouldCauseCycle,
  wouldCauseTagCycle,
  extractReferencedNodeIds,
  extractTagDefIds,
  extractDateTokens,
  convertReferencesToSnapshot,
  isUntitledOrEmpty,
} from '../src/invariants';

describe('Graph Invariants & Cycle Detection', () => {
  it('detects direct parent-child cycle', () => {
    // node A cannot have parent A
    expect(wouldCauseCycle('A', 'A', () => null)).toBe(true);
  });

  it('detects indirect ancestor cycle', () => {
    // Tree: Root -> A -> B -> C
    const parents: Record<string, string | null> = {
      Root: null,
      A: 'Root',
      B: 'A',
      C: 'B',
    };
    const getParent = (id: string) => parents[id] || null;

    // Moving A under C would cause cycle A -> ... -> C -> A
    expect(wouldCauseCycle('A', 'C', getParent)).toBe(true);

    // Moving C under Root is valid
    expect(wouldCauseCycle('C', 'Root', getParent)).toBe(false);

    // Moving B under Root is valid
    expect(wouldCauseCycle('B', 'Root', getParent)).toBe(false);
  });

  it('detects circular tag inheritance', () => {
    // Tag A extends B; Tag B extends C; Tag C extends A -> Cycle!
    const extendsMap: Record<string, string[]> = {
      tagA: ['tagB'],
      tagB: ['tagC'],
      tagC: [],
    };
    const getExtends = (id: string) => extendsMap[id] || [];

    // Tag C trying to extend Tag A
    expect(wouldCauseTagCycle('tagC', ['tagA'], getExtends)).toBe(true);

    // Tag C trying to extend an independent tag D
    expect(wouldCauseTagCycle('tagC', ['tagD'], getExtends)).toBe(false);
  });

  it('extracts tokens accurately', () => {
    const text = 'Meeting with [[node:01H123]] and [[node:01H456]] about #[[tag:01TAG]] on [[date:2026-11-03]]';
    expect(extractReferencedNodeIds(text)).toEqual(['01H123', '01H456']);
    expect(extractTagDefIds(text)).toEqual(['01TAG']);
    expect(extractDateTokens(text)).toEqual(['2026-11-03']);
  });

  it('converts referenced node token to plain text snapshot on delete', () => {
    const text = 'Met with [[node:01H123]] at the cafe.';
    const converted = convertReferencesToSnapshot(text, '01H123', 'Maya Lin');
    expect(converted).toBe('Met with Maya Lin at the cafe.');
  });

  it('correctly identifies untitled and empty entries', () => {
    expect(isUntitledOrEmpty('')).toBe(true);
    expect(isUntitledOrEmpty('   ')).toBe(true);
    expect(isUntitledOrEmpty(null)).toBe(true);
    expect(isUntitledOrEmpty(undefined)).toBe(true);
    expect(isUntitledOrEmpty('Untitled')).toBe(true);
    expect(isUntitledOrEmpty('untitled')).toBe(true);
    expect(isUntitledOrEmpty('Untitled Node')).toBe(true);
    expect(isUntitledOrEmpty('untitled node')).toBe(true);

    expect(isUntitledOrEmpty('Real Content')).toBe(false);
    expect(isUntitledOrEmpty('Untitled Project Spec')).toBe(false);
  });
});
