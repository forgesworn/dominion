import { describe, it, expect } from 'vitest';
import {
  defaultConfig,
  addToTier,
  removeFromTier,
  addIndividualGrant,
  removeIndividualGrant,
  revokePubkey,
  unrevokePubkey
} from '../src/config.js';

describe('defaultConfig', () => {
  it('returns a valid default config', () => {
    const config = defaultConfig();
    expect(config.tiers.family).toEqual([]);
    expect(config.tiers.connections).toBe('auto');
    expect(config.individualGrants).toEqual([]);
    expect(config.revokedPubkeys).toEqual([]);
  });

  it('returns a new object each time', () => {
    const a = defaultConfig();
    const b = defaultConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('tier mutations', () => {
  it('addToTier adds a pubkey to a tier', () => {
    const config = defaultConfig();
    const updated = addToTier(config, 'family', 'pubkey1');
    expect(updated.tiers.family).toContain('pubkey1');
    // Original not mutated
    expect(config.tiers.family).not.toContain('pubkey1');
  });

  it('addToTier is idempotent', () => {
    let config = defaultConfig();
    config = addToTier(config, 'family', 'pubkey1');
    config = addToTier(config, 'family', 'pubkey1');
    expect(config.tiers.family.filter(p => p === 'pubkey1')).toHaveLength(1);
  });

  it('addToTier creates new tier if it does not exist', () => {
    const config = defaultConfig();
    const updated = addToTier(config, 'subscribers', 'pubkey1');
    expect((updated.tiers.subscribers as string[])).toContain('pubkey1');
  });

  it('removeFromTier removes a pubkey', () => {
    let config = defaultConfig();
    config = addToTier(config, 'family', 'pubkey1');
    config = removeFromTier(config, 'family', 'pubkey1');
    expect(config.tiers.family).not.toContain('pubkey1');
  });

  it('removeFromTier is safe for missing pubkey', () => {
    const config = defaultConfig();
    const updated = removeFromTier(config, 'family', 'nonexistent');
    expect(updated.tiers.family).toEqual([]);
  });
});

describe('individual grants', () => {
  it('addIndividualGrant adds a grant', () => {
    const config = defaultConfig();
    const updated = addIndividualGrant(config, 'pubkey2', 'Uncle Bob');
    expect(updated.individualGrants).toHaveLength(1);
    expect(updated.individualGrants[0].pubkey).toBe('pubkey2');
    expect(updated.individualGrants[0].label).toBe('Uncle Bob');
    expect(typeof updated.individualGrants[0].grantedAt).toBe('number');
  });

  it('removeIndividualGrant removes a grant', () => {
    let config = defaultConfig();
    config = addIndividualGrant(config, 'pubkey2', 'Uncle Bob');
    config = removeIndividualGrant(config, 'pubkey2');
    expect(config.individualGrants).toHaveLength(0);
  });
});

describe('revocation', () => {
  it('revokePubkey adds to revoked list and removes from tiers and grants', () => {
    let config = defaultConfig();
    config = addToTier(config, 'family', 'pubkey1');
    config = addIndividualGrant(config, 'pubkey1', 'Test');
    config = revokePubkey(config, 'pubkey1');
    expect(config.revokedPubkeys).toContain('pubkey1');
    expect(config.tiers.family).not.toContain('pubkey1');
    expect(config.individualGrants.find(g => g.pubkey === 'pubkey1')).toBeUndefined();
  });

  it('revokePubkey is idempotent', () => {
    let config = defaultConfig();
    config = revokePubkey(config, 'pubkey1');
    config = revokePubkey(config, 'pubkey1');
    expect(config.revokedPubkeys.filter(p => p === 'pubkey1')).toHaveLength(1);
  });

  it('unrevokePubkey removes from revoked list', () => {
    let config = defaultConfig();
    config = revokePubkey(config, 'pubkey1');
    config = unrevokePubkey(config, 'pubkey1');
    expect(config.revokedPubkeys).not.toContain('pubkey1');
  });

  it('unrevokePubkey is safe for non-revoked pubkey', () => {
    const config = defaultConfig();
    const updated = unrevokePubkey(config, 'nonexistent');
    expect(updated.revokedPubkeys).toEqual([]);
  });
});

describe('edge cases', () => {
  it('addIndividualGrant is idempotent — updates label on duplicate', () => {
    let config = defaultConfig();
    config = addIndividualGrant(config, 'pubkey1', 'Original');
    config = addIndividualGrant(config, 'pubkey1', 'Updated');
    expect(config.individualGrants).toHaveLength(1);
    expect(config.individualGrants[0].label).toBe('Updated');
  });

  it('addToTier on an auto tier converts to explicit list', () => {
    const config = defaultConfig();
    expect(config.tiers.connections).toBe('auto');
    const updated = addToTier(config, 'connections', 'pubkey1');
    expect(Array.isArray(updated.tiers.connections)).toBe(true);
    expect(updated.tiers.connections).toContain('pubkey1');
  });

  it('removeFromTier on a non-existent tier is safe', () => {
    const config = defaultConfig();
    const updated = removeFromTier(config, 'nonexistent', 'pubkey1');
    expect(updated).toEqual(config);
  });

  it('removeFromTier on an auto tier is a no-op', () => {
    const config = defaultConfig();
    const updated = removeFromTier(config, 'connections', 'pubkey1');
    expect(updated.tiers.connections).toBe('auto');
  });

  it('rejects __proto__ as tier name', () => {
    const config = defaultConfig();
    expect(() => addToTier(config, '__proto__', 'pubkey1')).toThrow('Reserved tier name');
  });

  it('rejects constructor as tier name', () => {
    const config = defaultConfig();
    expect(() => addToTier(config, 'constructor', 'pubkey1')).toThrow('Reserved tier name');
  });

  it('rejects prototype as tier name', () => {
    const config = defaultConfig();
    expect(() => addToTier(config, 'prototype', 'pubkey1')).toThrow('Reserved tier name');
  });
});
