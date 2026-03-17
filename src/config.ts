import type { DominionConfig } from './types.js';

/** Create a default vault configuration. */
export function defaultConfig(): DominionConfig {
  return {
    tiers: {
      family: [],
      connections: 'auto',
    },
    individualGrants: [],
    revokedPubkeys: [],
  };
}

/** Add a pubkey to a tier. Creates the tier if it doesn't exist. */
export function addToTier(config: DominionConfig, tier: string, pubkey: string): DominionConfig {
  const currentTier = config.tiers[tier];
  const list = Array.isArray(currentTier) ? currentTier : [];
  if (list.includes(pubkey)) return config;
  return {
    ...config,
    tiers: { ...config.tiers, [tier]: [...list, pubkey] },
  };
}

/** Remove a pubkey from a tier. */
export function removeFromTier(config: DominionConfig, tier: string, pubkey: string): DominionConfig {
  const currentTier = config.tiers[tier];
  if (!Array.isArray(currentTier)) return config;
  return {
    ...config,
    tiers: { ...config.tiers, [tier]: currentTier.filter(p => p !== pubkey) },
  };
}

/** Add an individual grant. Idempotent — updates label if pubkey already exists. */
export function addIndividualGrant(config: DominionConfig, pubkey: string, label: string): DominionConfig {
  if (config.individualGrants.some(g => g.pubkey === pubkey)) {
    return {
      ...config,
      individualGrants: config.individualGrants.map(g =>
        g.pubkey === pubkey ? { ...g, label } : g
      ),
    };
  }
  return {
    ...config,
    individualGrants: [
      ...config.individualGrants,
      { pubkey, label, grantedAt: Math.floor(Date.now() / 1000) },
    ],
  };
}

/** Remove an individual grant by pubkey. */
export function removeIndividualGrant(config: DominionConfig, pubkey: string): DominionConfig {
  return {
    ...config,
    individualGrants: config.individualGrants.filter(g => g.pubkey !== pubkey),
  };
}

/** Revoke a pubkey — removes from all tiers, removes grants, adds to revoked list. */
export function revokePubkey(config: DominionConfig, pubkey: string): DominionConfig {
  const newTiers = { ...config.tiers };
  for (const [tier, members] of Object.entries(newTiers)) {
    if (Array.isArray(members)) {
      newTiers[tier] = members.filter(p => p !== pubkey);
    }
  }

  return {
    ...config,
    tiers: newTiers,
    individualGrants: config.individualGrants.filter(g => g.pubkey !== pubkey),
    revokedPubkeys: config.revokedPubkeys.includes(pubkey)
      ? config.revokedPubkeys
      : [...config.revokedPubkeys, pubkey],
  };
}

/** Un-revoke a pubkey — removes from revoked list (does not re-add to tiers). */
export function unrevokePubkey(config: DominionConfig, pubkey: string): DominionConfig {
  return {
    ...config,
    revokedPubkeys: config.revokedPubkeys.filter(p => p !== pubkey),
  };
}
