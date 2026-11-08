/**
 * Thompson Sampling with Beta Distribution & Seedable RNG (Section 8.1, 10.3, 17)
 */

export class SeededRNG {
  private s: number;

  constructor(seed: number = 1337) {
    this.s = Math.abs(seed) || 1337;
  }

  // Mulberry32
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Generates a standard normal random variable using Box-Muller transform
 */
function randomNormal(rng: SeededRNG): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Marsaglia and Tsang method for Gamma(alpha, 1)
 */
function sampleGamma(alpha: number, rng: SeededRNG): number {
  if (alpha < 1) {
    // For alpha < 1, use property: Gamma(alpha) = Gamma(alpha + 1) * U^(1/alpha)
    return sampleGamma(alpha + 1, rng) * Math.pow(rng.next(), 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let z = randomNormal(rng);
    let v = 1 + c * z;
    while (v <= 0) {
      z = randomNormal(rng);
      v = 1 + c * z;
    }

    v = v * v * v;
    const u = rng.next();

    if (u < 1 - 0.0331 * z * z * z * z) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Draws a sample from Beta(alpha, beta)
 */
export function sampleBeta(alpha: number, beta: number, rng: SeededRNG = new SeededRNG()): number {
  const safeAlpha = Math.max(0.1, alpha);
  const safeBeta = Math.max(0.1, beta);

  const x = sampleGamma(safeAlpha, rng);
  const y = sampleGamma(safeBeta, rng);

  if (x + y === 0) return 0.5;
  return Math.min(1.0, Math.max(0.0, x / (x + y)));
}
