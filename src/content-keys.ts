import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { CK_SALT } from './constants.js';
import type { EpochLength } from './types.js';

/**
 * Derive a 32-byte Content Key for a given epoch and tier.
 * CK = HKDF-SHA256(ikm=privkey, salt="dominion-ck-v1", info="epoch:{epochId}:tier:{tier}")
 */
export function deriveContentKey(privkeyHex: string, epochId: string, tier: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(privkeyHex)) throw new Error('Private key must be 64 lowercase hex characters');
  if (!epochId) throw new Error('Epoch ID must not be empty');
  if (!tier) throw new Error('Tier must not be empty');
  if (epochId.includes(':tier:')) throw new Error('Epoch ID must not contain ":tier:" delimiter');
  if (tier.includes(':')) throw new Error('Tier must not contain colons');
  const ikm = hexToBytes(privkeyHex);
  const salt = new TextEncoder().encode(CK_SALT);
  const info = new TextEncoder().encode(`epoch:${epochId}:tier:${tier}`);
  return hkdf(sha256, ikm, salt, info, 32);
}

/** Convert a 32-byte Content Key to a hex string. */
export function contentKeyToHex(ck: Uint8Array): string {
  return bytesToHex(ck);
}

/**
 * Get the current epoch ID for a given epoch length. Defaults to weekly.
 *
 * Format depends on length:
 *   - daily   → `YYYY-MM-DD` (ISO 8601 date)
 *   - weekly  → `YYYY-Www`   (ISO 8601 week)
 *   - monthly → `YYYY-MM`    (ISO 8601 year-month)
 */
export function getCurrentEpochId(length: EpochLength = 'weekly'): string {
  return getEpochIdForDate(new Date(), length);
}

/**
 * Get the epoch ID for a specific date and epoch length. Uses UTC to
 * ensure cross-timezone consistency. Defaults to weekly for backwards
 * compatibility with the original single-argument call.
 */
export function getEpochIdForDate(date: Date, length: EpochLength = 'weekly'): string {
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (length === 'daily') {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (length === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  // Weekly (default) — ISO 8601 week computation, unchanged from v1.0.
  const d = new Date(Date.UTC(year, date.getUTCMonth(), day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
