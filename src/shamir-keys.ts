import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { combineShares, splitSecret } from './shamir.js';
import type { CKShare } from './types.js';

/**
 * Split a 32-byte Content Key into Shamir shares.
 */
export function splitCK(ck: Uint8Array, threshold: number, total: number): CKShare[] {
  if (ck.length !== 32) throw new Error('Content key must be 32 bytes');
  return splitSecret(ck, threshold, total);
}

/**
 * Reconstruct a Content Key from Shamir shares.
 */
export function reconstructCK(shares: CKShare[]): Uint8Array {
  return combineShares(shares);
}

/**
 * Encode a CK share as "index:hexdata".
 */
export function encodeCKShare(share: CKShare): string {
  return `${share.index}:${bytesToHex(share.data)}`;
}

/**
 * Decode a CK share from "index:hexdata" format.
 */
export function decodeCKShare(encoded: string): CKShare {
  const colonIdx = encoded.indexOf(':');
  if (colonIdx === -1) throw new Error('Invalid CK share: missing colon separator');

  const indexStr = encoded.slice(0, colonIdx);
  const hexStr = encoded.slice(colonIdx + 1);

  const index = parseInt(indexStr, 10);
  if (Number.isNaN(index) || index < 1 || index > 255) throw new Error('Invalid CK share: bad index');

  if (!/^[0-9a-f]+$/.test(hexStr) || hexStr.length % 2 !== 0) {
    throw new Error('Invalid CK share: bad hex data');
  }

  if (hexStr.length !== 64) {
    throw new Error('Invalid CK share: data must be 32 bytes (64 hex chars)');
  }

  return { index, data: hexToBytes(hexStr) };
}
