// Types

export type { ShamirShare } from '@forgesworn/shamir-core';
// Shamir secret sharing (re-exported from @forgesworn/shamir-core)
export { reconstructSecret, splitSecret } from '@forgesworn/shamir-core';
// Config mutations
export {
  addIndividualGrant,
  addToTier,
  defaultConfig,
  removeFromTier,
  removeIndividualGrant,
  revokePubkey,
  unrevokePubkey,
} from './config.js';
// Constants
export {
  CK_SALT,
  DEFAULT_EPOCH_LENGTH,
  DOMINION_VERSION,
  KIND_VAULT_CONFIG,
  KIND_VAULT_SHARE,
  LEGACY_PROTOCOL_LABEL,
  PROTOCOL_LABEL,
} from './constants.js';
// Content keys
export { contentKeyToHex, deriveContentKey, getCurrentEpochId, getEpochIdForDate } from './content-keys.js';
// Encryption
export { decrypt, decryptBlob, encrypt, encryptBlob } from './encrypt.js';

// CK splitting
export { decodeCKShare, encodeCKShare, reconstructCK, splitCK } from './shamir-keys.js';
export type {
  CKShare,
  CryptoAlgorithm,
  DominionConfig,
  EpochConfig,
  EpochLength,
  IndividualGrant,
  NostrEvent,
  TierName,
  VaultShareData,
} from './types.js';
