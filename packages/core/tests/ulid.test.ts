import { describe, it, expect } from 'vitest';
import { ulid, isValidUlid, decodeTime } from '../src/ulid';

describe('ULID Generator', () => {
  it('generates a valid 26-character ULID', () => {
    const id = ulid();
    expect(id.length).toBe(26);
    expect(isValidUlid(id)).toBe(true);
  });

  it('encodes timestamp accurately', () => {
    const now = 1700000000000;
    const id = ulid(now);
    const decoded = decodeTime(id);
    expect(decoded).toBe(now);
  });

  it('generates strictly monotonic sortable IDs within the same millisecond', () => {
    const now = 1700000000000;
    const id1 = ulid(now);
    const id2 = ulid(now);
    const id3 = ulid(now);

    expect(id1 < id2).toBe(true);
    expect(id2 < id3).toBe(true);
  });
});
