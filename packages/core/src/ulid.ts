/**
 * Pure ULID Generator (Crockford's Base32)
 * Zero dependencies, works in Node, browser, and Web Worker.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
const lastRandom: number[] = new Array(RANDOM_LEN).fill(0);

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function encodeTime(now: number, len: number = TIME_LEN): string {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}

export function decodeTime(id: string): number {
  const timeStr = id.slice(0, TIME_LEN);
  let time = 0;
  for (let i = 0; i < timeStr.length; i++) {
    const index = ENCODING.indexOf(timeStr.charAt(i));
    if (index === -1) throw new Error(`Invalid ULID character: ${timeStr.charAt(i)}`);
    time = time * ENCODING_LEN + index;
  }
  return time;
}

export function ulid(seedTime: number = Date.now()): string {
  const timeStr = encodeTime(seedTime, TIME_LEN);

  if (seedTime === lastTime) {
    // Increment randomness for monotonic order
    for (let i = RANDOM_LEN - 1; i >= 0; i--) {
      lastRandom[i] = (lastRandom[i] + 1) % ENCODING_LEN;
      if (lastRandom[i] !== 0) break;
    }
  } else {
    lastTime = seedTime;
    for (let i = 0; i < RANDOM_LEN; i++) {
      lastRandom[i] = randomInt(ENCODING_LEN);
    }
  }

  let randStr = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    randStr += ENCODING.charAt(lastRandom[i]);
  }

  return timeStr + randStr;
}

export const generateUlid = ulid;

export function isValidUlid(id: string): boolean {
  if (!id || typeof id !== 'string' || id.length !== 26) return false;
  for (let i = 0; i < id.length; i++) {
    if (ENCODING.indexOf(id[i].toUpperCase()) === -1) return false;
  }
  return true;
}
