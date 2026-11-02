import { describe, it, expect } from 'vitest';
import { generateKeyBetween, generateNKeysBetween, getInitialKey } from '../src/fractional';

describe('Fractional Indexing', () => {
  it('generates an initial key', () => {
    const k = getInitialKey();
    expect(k).toBe('a0');
  });

  it('generates a key after an existing key', () => {
    const k1 = 'a0';
    const k2 = generateKeyBetween(k1, null);
    expect(k2 > k1).toBe(true);
  });

  it('generates a key before an existing key', () => {
    const k2 = 'a0';
    const k1 = generateKeyBetween(null, k2);
    expect(k1 < k2).toBe(true);
  });

  it('generates a key strictly between two keys', () => {
    const k1 = 'a0';
    const k2 = 'a1';
    const mid = generateKeyBetween(k1, k2);
    expect(mid > k1).toBe(true);
    expect(mid < k2).toBe(true);
  });

  it('generates multiple keys in strict ascending order', () => {
    const keys = generateNKeysBetween(null, null, 10);
    expect(keys.length).toBe(10);
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i] < keys[i + 1]).toBe(true);
    }
  });

  it('can repeatedly insert between adjacent items without collision', () => {
    let a = 'a0';
    const b = 'a1';
    for (let i = 0; i < 20; i++) {
      const mid = generateKeyBetween(a, b);
      expect(mid > a).toBe(true);
      expect(mid < b).toBe(true);
      a = mid;
    }
  });
});
