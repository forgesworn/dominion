import { describe, expect, it } from 'vitest';
import { decodeCKShare, encodeCKShare, reconstructCK, splitCK } from '../src/shamir-keys.js';

const TEST_CK = new Uint8Array(32).fill(0).map((_, i) => i * 8);

describe('splitCK / reconstructCK', () => {
  it('splits a 32-byte CK into 3 shares', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    expect(shares).toHaveLength(3);
    shares.forEach((s) => {
      expect(typeof s.index).toBe('number');
      expect(s.data).toBeInstanceOf(Uint8Array);
      expect(s.data.length).toBe(32);
    });
  });

  it('reconstructs from 2-of-3 shares (first two)', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    const recovered = reconstructCK([shares[0], shares[1]]);
    expect(Array.from(recovered)).toEqual(Array.from(TEST_CK));
  });

  it('reconstructs from 2-of-3 shares (last two)', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    const recovered = reconstructCK([shares[1], shares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(TEST_CK));
  });

  it('reconstructs from 2-of-3 shares (first and last)', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    const recovered = reconstructCK([shares[0], shares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(TEST_CK));
  });

  it('reconstructs from all 3 shares', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    const recovered = reconstructCK(shares);
    expect(Array.from(recovered)).toEqual(Array.from(TEST_CK));
  });

  it('fails to reconstruct from 1 share (below threshold)', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    expect(() => reconstructCK([shares[0]])).toThrow();
  });

  it('rejects non-32-byte input', () => {
    expect(() => splitCK(new Uint8Array(16), 2, 3)).toThrow('Content key must be 32 bytes');
    expect(() => splitCK(new Uint8Array(0), 2, 3)).toThrow('Content key must be 32 bytes');
    expect(() => splitCK(new Uint8Array(33), 2, 3)).toThrow('Content key must be 32 bytes');
  });
});

describe('encodeCKShare / decodeCKShare', () => {
  it('roundtrips a share through encode/decode', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    for (const share of shares) {
      const encoded = encodeCKShare(share);
      expect(typeof encoded).toBe('string');
      expect(encoded).toMatch(/^\d+:[0-9a-f]+$/);

      const decoded = decodeCKShare(encoded);
      expect(decoded.index).toBe(share.index);
      expect(Array.from(decoded.data)).toEqual(Array.from(share.data));
    }
  });

  it('reconstructs from decoded shares', () => {
    const shares = splitCK(TEST_CK, 2, 3);
    const encodedShares = shares.map(encodeCKShare);
    const decodedShares = encodedShares.map(decodeCKShare);
    const recovered = reconstructCK([decodedShares[0], decodedShares[2]]);
    expect(Array.from(recovered)).toEqual(Array.from(TEST_CK));
  });

  it('rejects invalid encoded share (no colon)', () => {
    expect(() => decodeCKShare('invalid')).toThrow('missing colon separator');
  });

  it('rejects invalid encoded share (bad index)', () => {
    expect(() => decodeCKShare('0:aabbcc')).toThrow('bad index');
    expect(() => decodeCKShare('-1:aabbcc')).toThrow('bad index');
    expect(() => decodeCKShare('abc:aabbcc')).toThrow('bad index');
  });

  it('rejects invalid encoded share (bad hex)', () => {
    expect(() => decodeCKShare('1:gg')).toThrow('bad hex data');
    expect(() => decodeCKShare('1:abc')).toThrow('bad hex data');
  });

  it('rejects share index > 255 (GF(256) limit)', () => {
    expect(() => decodeCKShare(`256:${'aa'.repeat(32)}`)).toThrow('bad index');
  });

  it('accepts share index 255 (boundary)', () => {
    const decoded = decodeCKShare(`255:${'ab'.repeat(32)}`);
    expect(decoded.index).toBe(255);
    expect(decoded.data.length).toBe(32);
  });

  it('rejects share data that is not 32 bytes', () => {
    expect(() => decodeCKShare('1:aabb')).toThrow('data must be 32 bytes');
    expect(() => decodeCKShare(`1:${'aa'.repeat(16)}`)).toThrow('data must be 32 bytes');
    expect(() => decodeCKShare(`1:${'aa'.repeat(33)}`)).toThrow('data must be 32 bytes');
  });

  it('rejects decimal index like "1.5"', () => {
    expect(() => decodeCKShare(`1.5:${'aa'.repeat(32)}`)).toThrow('bad index');
  });

  it('rejects negative index', () => {
    expect(() => decodeCKShare(`-1:${'aa'.repeat(32)}`)).toThrow('bad index');
  });

  it('rejects non-numeric index', () => {
    expect(() => decodeCKShare(`foo:${'aa'.repeat(32)}`)).toThrow('bad index');
  });
});
