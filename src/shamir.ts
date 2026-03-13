import { randomBytes } from '@noble/ciphers/utils.js';
import type { CKShare } from './types.js';

// GF(256) arithmetic with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11b)

function gfMul(a: number, b: number): number {
  let result = 0;
  let _a = a;
  let _b = b;
  while (_b > 0) {
    if (_b & 1) result ^= _a;
    _a <<= 1;
    if (_a & 0x100) _a ^= 0x11b;
    _b >>= 1;
  }
  return result;
}

function gfInv(a: number): number {
  if (a === 0) throw new Error('Cannot invert zero in GF(256)');
  // Fermat's little theorem: a^(-1) = a^(254) in GF(256)
  let result = a;
  for (let i = 0; i < 6; i++) {
    result = gfMul(result, result);
    result = gfMul(result, a);
  }
  // One more squaring to get a^254
  result = gfMul(result, result);
  return result;
}

/**
 * Split a secret into `totalShares` shares with a reconstruction `threshold`.
 * Uses GF(256) Shamir secret sharing — each byte independently.
 */
export function splitSecret(secret: Uint8Array, totalShares: number, threshold: number): CKShare[] {
  if (threshold > totalShares) throw new Error('Threshold cannot exceed total shares');
  if (threshold < 2) throw new Error('Threshold must be at least 2');
  if (totalShares < 2) throw new Error('Total shares must be at least 2');

  const shares: CKShare[] = Array.from({ length: totalShares }, (_, i) => ({
    index: i + 1,
    data: new Uint8Array(secret.length),
  }));

  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // Random polynomial coefficients: a[0] = secret byte, a[1..threshold-1] = random
    const coeffs = new Uint8Array(threshold);
    coeffs[0] = secret[byteIdx];
    const rand = randomBytes(threshold - 1);
    coeffs.set(rand, 1);

    // Evaluate polynomial at points 1..totalShares
    for (let shareIdx = 0; shareIdx < totalShares; shareIdx++) {
      const x = shareIdx + 1;
      let y = 0;
      for (let k = threshold - 1; k >= 0; k--) {
        y = gfMul(y, x) ^ coeffs[k];
      }
      shares[shareIdx].data[byteIdx] = y;
    }
  }

  return shares;
}

/**
 * Reconstruct a secret from shares using Lagrange interpolation at x=0.
 */
export function combineShares(shares: CKShare[]): Uint8Array {
  if (shares.length < 2) throw new Error('Need at least 2 shares to reconstruct');

  const len = shares[0].data.length;
  const result = new Uint8Array(len);

  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    let secret = 0;
    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i].index;
      let lagrange = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        const xj = shares[j].index;
        lagrange = gfMul(lagrange, gfMul(xj, gfInv(xj ^ xi)));
      }
      secret ^= gfMul(shares[i].data[byteIdx], lagrange);
    }
    result[byteIdx] = secret;
  }

  return result;
}
