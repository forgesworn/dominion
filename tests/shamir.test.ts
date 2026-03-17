import { describe, it, expect } from 'vitest';
import { splitSecret, combineShares } from '../src/shamir.js';

describe('Shamir secret sharing', () => {
  it('splits and combines a secret with 2-of-3', () => {
    const secret = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const shares = splitSecret(secret, 2, 3);

    expect(shares).toHaveLength(3);
    shares.forEach(s => expect(s.data.length).toBe(5));

    // Any 2 of 3 should reconstruct
    expect(Array.from(combineShares([shares[0], shares[1]]))).toEqual(Array.from(secret));
    expect(Array.from(combineShares([shares[1], shares[2]]))).toEqual(Array.from(secret));
    expect(Array.from(combineShares([shares[0], shares[2]]))).toEqual(Array.from(secret));
  });

  it('works with 3-of-5 threshold', () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const shares = splitSecret(secret, 3, 5);

    expect(shares).toHaveLength(5);
    const recovered = combineShares([shares[0], shares[2], shares[4]]);
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it('handles zero bytes', () => {
    const secret = new Uint8Array([0, 0, 0, 255, 0]);
    const shares = splitSecret(secret, 2, 3);
    const recovered = combineShares([shares[0], shares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it('rejects threshold > total', () => {
    const secret = new Uint8Array([1]);
    expect(() => splitSecret(secret, 3, 2)).toThrow();
  });

  it('rejects fewer shares than threshold for combine', () => {
    const secret = new Uint8Array([1]);
    const shares = splitSecret(secret, 2, 3);
    expect(() => combineShares([shares[0]])).toThrow();
  });

  it('handles single-byte secret', () => {
    const secret = new Uint8Array([42]);
    const shares = splitSecret(secret, 2, 3);
    const recovered = combineShares([shares[0], shares[2]]);
    expect(Array.from(recovered)).toEqual([42]);
  });

  it('handles 32-byte secret (CK-sized)', () => {
    const secret = new Uint8Array(32).fill(0).map((_, i) => i * 8);
    const shares = splitSecret(secret, 3, 5);
    const recovered = combineShares([shares[1], shares[3], shares[4]]);
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it('rejects totalShares < 2', () => {
    expect(() => splitSecret(new Uint8Array([42]), 1, 1)).toThrow();
  });

  it('rejects threshold < 2', () => {
    expect(() => splitSecret(new Uint8Array([42]), 1, 3)).toThrow();
  });

  it('handles all-zero secret', () => {
    const secret = new Uint8Array(8).fill(0);
    const shares = splitSecret(secret, 2, 3);
    const recovered = combineShares([shares[0], shares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it('handles all-0xFF secret', () => {
    const secret = new Uint8Array(8).fill(0xff);
    const shares = splitSecret(secret, 2, 3);
    const recovered = combineShares([shares[1], shares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(secret));
  });

  it('rejects shares with mismatched data lengths', () => {
    const share1 = { index: 1, data: new Uint8Array([1, 2, 3]) };
    const share2 = { index: 2, data: new Uint8Array([4, 5]) };
    expect(() => combineShares([share1, share2])).toThrow('All shares must have equal data length');
  });

  it('rejects totalShares > 255 (GF(256) limit)', () => {
    expect(() => splitSecret(new Uint8Array([42]), 2, 256))
      .toThrow('Total shares cannot exceed 255 (GF(256) limit)');
  });

  it('accepts totalShares = 255 (GF(256) boundary)', () => {
    const shares = splitSecret(new Uint8Array([42]), 2, 255);
    expect(shares).toHaveLength(255);
  });

  it('rejects duplicate share indices', () => {
    const share1 = { index: 1, data: new Uint8Array([10]) };
    const share2 = { index: 1, data: new Uint8Array([20]) };
    expect(() => combineShares([share1, share2])).toThrow('Duplicate share indices detected');
  });

  it('rejects share index 0 in combineShares', () => {
    const share1 = { index: 0, data: new Uint8Array([10]) };
    const share2 = { index: 2, data: new Uint8Array([20]) };
    expect(() => combineShares([share1, share2])).toThrow('Share index must be between 1 and 255');
  });

  it('rejects share index > 255 in combineShares', () => {
    const share1 = { index: 1, data: new Uint8Array([10]) };
    const share2 = { index: 300, data: new Uint8Array([20]) };
    expect(() => combineShares([share1, share2])).toThrow('Share index must be between 1 and 255');
  });
});
