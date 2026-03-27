import { describe, expect, it } from 'vitest';
import { contentKeyToHex, deriveContentKey, getCurrentEpochId, getEpochIdForDate } from '../src/content-keys.js';
import { TEST_EPOCH_ID, TEST_PRIVKEY_HEX, TEST_PRIVKEY_HEX_B, TEST_TIER } from './fixtures.js';

describe('content key derivation', () => {
  it('derives a 32-byte content key from privkey, epoch, and tier', () => {
    const ck = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
    expect(ck).toBeInstanceOf(Uint8Array);
    expect(ck.length).toBe(32);
  });

  it('produces deterministic output for same inputs', () => {
    const ck1 = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
    const ck2 = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
    expect(contentKeyToHex(ck1)).toBe(contentKeyToHex(ck2));
  });

  it('produces different keys for different epochs', () => {
    const ck1 = deriveContentKey(TEST_PRIVKEY_HEX, '2026-W09', TEST_TIER);
    const ck2 = deriveContentKey(TEST_PRIVKEY_HEX, '2026-W10', TEST_TIER);
    expect(contentKeyToHex(ck1)).not.toBe(contentKeyToHex(ck2));
  });

  it('produces different keys for different private keys', () => {
    const ck1 = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
    const ck2 = deriveContentKey(TEST_PRIVKEY_HEX_B, TEST_EPOCH_ID, TEST_TIER);
    expect(contentKeyToHex(ck1)).not.toBe(contentKeyToHex(ck2));
  });

  it('produces different keys for different tiers', () => {
    const ck1 = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, 'family');
    const ck2 = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, 'connections');
    expect(contentKeyToHex(ck1)).not.toBe(contentKeyToHex(ck2));
  });

  it('generates a valid current epoch ID', () => {
    const epoch = getCurrentEpochId();
    expect(epoch).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('computes epoch ID for a specific date', () => {
    const epoch = getEpochIdForDate(new Date(2026, 1, 26));
    expect(epoch).toBe('2026-W09');
  });

  it('handles week numbers correctly at year boundaries', () => {
    const epoch = getEpochIdForDate(new Date(2026, 0, 1));
    expect(epoch).toBe('2026-W01');
  });

  it('converts content key to hex string', () => {
    const ck = deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, TEST_TIER);
    const hex = contentKeyToHex(ck);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects private key that is too short', () => {
    expect(() => deriveContentKey('aa'.repeat(16), TEST_EPOCH_ID, TEST_TIER)).toThrow(
      'Private key must be 64 lowercase hex characters',
    );
  });

  it('rejects private key that is too long', () => {
    expect(() => deriveContentKey('aa'.repeat(33), TEST_EPOCH_ID, TEST_TIER)).toThrow(
      'Private key must be 64 lowercase hex characters',
    );
  });

  it('rejects empty private key', () => {
    expect(() => deriveContentKey('', TEST_EPOCH_ID, TEST_TIER)).toThrow(
      'Private key must be 64 lowercase hex characters',
    );
  });

  it('uses UTC consistently — same instant produces same epoch regardless of input construction', () => {
    // Both represent the same UTC moment
    const fromUTC = getEpochIdForDate(new Date(Date.UTC(2026, 0, 5)));
    const fromUTC2 = getEpochIdForDate(new Date(Date.UTC(2026, 0, 5, 23, 59, 59)));
    expect(fromUTC).toBe(fromUTC2);
  });

  it('rejects non-hex characters in private key', () => {
    expect(() => deriveContentKey('zz'.repeat(32), TEST_EPOCH_ID, TEST_TIER)).toThrow(
      'Private key must be 64 lowercase hex characters',
    );
  });

  it('rejects uppercase hex in private key', () => {
    expect(() => deriveContentKey('AA'.repeat(32), TEST_EPOCH_ID, TEST_TIER)).toThrow(
      'Private key must be 64 lowercase hex characters',
    );
  });

  it('rejects empty epoch ID', () => {
    expect(() => deriveContentKey(TEST_PRIVKEY_HEX, '', TEST_TIER)).toThrow('Epoch ID must not be empty');
  });

  it('rejects empty tier', () => {
    expect(() => deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, '')).toThrow('Tier must not be empty');
  });

  it('rejects invalid Date', () => {
    expect(() => getEpochIdForDate(new Date('invalid'))).toThrow('Invalid date');
  });

  it('handles Dec 31 → Jan 1 year boundary (2025-12-29 is W01 of 2026)', () => {
    // ISO 8601: Dec 29, 2025 (Monday) is the start of W01 2026
    const epoch = getEpochIdForDate(new Date(Date.UTC(2025, 11, 29)));
    expect(epoch).toBe('2026-W01');
  });

  it('handles Dec 28 as last week of 2025', () => {
    const epoch = getEpochIdForDate(new Date(Date.UTC(2025, 11, 28)));
    expect(epoch).toBe('2025-W52');
  });

  it('handles Jan 1 2027 (Thursday — still W53 of 2026 per ISO)', () => {
    // 2026 has 53 weeks; Jan 1 2027 is a Friday, part of W53 of 2026
    const epoch = getEpochIdForDate(new Date(Date.UTC(2027, 0, 1)));
    expect(epoch).toBe('2026-W53');
  });

  it('rejects epochId containing ":tier:" delimiter (HKDF info collision prevention)', () => {
    expect(() => deriveContentKey(TEST_PRIVKEY_HEX, '2026-W09:tier:family', 'x')).toThrow(
      'Epoch ID must not contain ":tier:" delimiter',
    );
  });

  it('rejects tier containing colons (HKDF info collision prevention)', () => {
    expect(() => deriveContentKey(TEST_PRIVKEY_HEX, TEST_EPOCH_ID, 'tier:with:colons')).toThrow(
      'Tier must not contain colons',
    );
  });
});
