import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { CK_SALT } from './constants.js';

/**
 * Derive a 32-byte Content Key for a given epoch and tier.
 * CK = HKDF-SHA256(ikm=privkey, salt="vaulstr-ck-v1", info="epoch:{epochId}:tier:{tier}")
 */
export function deriveContentKey(privkeyHex: string, epochId: string, tier: string): Uint8Array {
  if (privkeyHex.length !== 64) throw new Error('Private key must be 32 bytes (64 hex chars)');
  const ikm = hexToBytes(privkeyHex);
  const salt = new TextEncoder().encode(CK_SALT);
  const info = new TextEncoder().encode(`epoch:${epochId}:tier:${tier}`);
  return hkdf(sha256, ikm, salt, info, 32);
}

/** Convert a 32-byte Content Key to a hex string. */
export function contentKeyToHex(ck: Uint8Array): string {
  return bytesToHex(ck);
}

/** Get the current ISO week epoch ID (format: YYYY-Www). */
export function getCurrentEpochId(): string {
  return getEpochIdForDate(new Date());
}

/** Get the ISO week epoch ID for a specific date (format: YYYY-Www). Uses UTC to ensure cross-timezone consistency. */
export function getEpochIdForDate(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
