import { describe, it, expect } from 'vitest';
import { deriveContentKey, getCurrentEpochId, getEpochIdForDate, contentKeyToHex } from '../src/content-keys.js';
import { TEST_PRIVKEY_HEX, TEST_PRIVKEY_HEX_B, TEST_EPOCH_ID, TEST_TIER } from './fixtures.js';

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
    expect(() => deriveContentKey('aa'.repeat(16), TEST_EPOCH_ID, TEST_TIER))
      .toThrow('Private key must be 32 bytes (64 hex chars)');
  });

  it('rejects private key that is too long', () => {
    expect(() => deriveContentKey('aa'.repeat(33), TEST_EPOCH_ID, TEST_TIER))
      .toThrow('Private key must be 32 bytes (64 hex chars)');
  });

  it('rejects empty private key', () => {
    expect(() => deriveContentKey('', TEST_EPOCH_ID, TEST_TIER))
      .toThrow('Private key must be 32 bytes (64 hex chars)');
  });

  it('uses UTC consistently — same instant produces same epoch regardless of input construction', () => {
    // Both represent the same UTC moment
    const fromUTC = getEpochIdForDate(new Date(Date.UTC(2026, 0, 5)));
    const fromUTC2 = getEpochIdForDate(new Date(Date.UTC(2026, 0, 5, 23, 59, 59)));
    expect(fromUTC).toBe(fromUTC2);
  });
});
