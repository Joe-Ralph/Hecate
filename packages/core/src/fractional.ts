/**
 * Fractional Indexing implementation for ordering nodes.
 * Guarantees lexicographical ordering: prev < generateKeyBetween(prev, next) < next
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const SMALLEST_DIGIT = DIGITS[0]; // '0'
const LARGEST_DIGIT = DIGITS[DIGITS.length - 1]; // 'z'
const MID_DIGIT = DIGITS[Math.floor(DIGITS.length / 2)]; // 'i'
const START_KEY = 'a0';

export function getInitialKey(): string {
  return START_KEY;
}

export function generateKeyBetween(prev: string | null | undefined, next: string | null | undefined): string {
  if (!prev && !next) {
    return START_KEY;
  }

  // Insert before the first item
  if (!prev && next) {
    let result = '';
    for (let i = 0; i < next.length; i++) {
      const nextChar = next[i];
      const nextIdx = DIGITS.indexOf(nextChar);
      if (nextIdx > 0) {
        // Find a character smaller than nextChar
        const midIdx = Math.floor(nextIdx / 2);
        return result + DIGITS[midIdx];
      }
      result += SMALLEST_DIGIT;
    }
    return result + MID_DIGIT;
  }

  // Insert after the last item
  if (prev && !next) {
    const lastChar = prev[prev.length - 1];
    const lastIdx = DIGITS.indexOf(lastChar);
    if (lastIdx < DIGITS.length - 1) {
      // We can just increment the last character
      return prev.slice(0, -1) + DIGITS[lastIdx + 1];
    }
    // Otherwise append mid digit
    return prev + MID_DIGIT;
  }

  // Insert between prev and next
  if (prev && next) {
    if (prev >= next) {
      throw new Error(`Invalid fractional range: prev "${prev}" must be < next "${next}"`);
    }

    let i = 0;
    let result = '';
    while (true) {
      const prevChar = i < prev.length ? prev[i] : SMALLEST_DIGIT;
      const nextChar = i < next.length ? next[i] : LARGEST_DIGIT;

      const prevIdx = DIGITS.indexOf(prevChar);
      const nextIdx = DIGITS.indexOf(nextChar);

      if (prevIdx === nextIdx) {
        result += prevChar;
        i++;
        continue;
      }

      if (nextIdx - prevIdx > 1) {
        // Space between characters
        const midIdx = Math.floor((prevIdx + nextIdx) / 2);
        return result + DIGITS[midIdx];
      }

      // Difference is 1 (adjacent characters)
      result += prevChar;
      i++;
      // Check next position in prev
      while (i < prev.length && prev[i] === LARGEST_DIGIT) {
        result += prev[i];
        i++;
      }

      if (i < prev.length) {
        const char = prev[i];
        const idx = DIGITS.indexOf(char);
        const midIdx = Math.floor((idx + DIGITS.length) / 2);
        return result + DIGITS[midIdx];
      }

      return result + MID_DIGIT;
    }
  }

  return START_KEY;
}

export function generateNKeysBetween(
  prev: string | null | undefined,
  next: string | null | undefined,
  count: number
): string[] {
  const result: string[] = [];
  let currentPrev = prev;
  for (let i = 0; i < count; i++) {
    const key = generateKeyBetween(currentPrev, next);
    result.push(key);
    currentPrev = key;
  }
  return result;
}
