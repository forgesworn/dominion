// Types
export type {
  DominionConfig,
  IndividualGrant,
  CKShare,
  TierName,
  EpochLength,
  EpochConfig,
  CryptoAlgorithm,
  NostrEvent,
  VaultShareData,
} from './types.js';

// Constants
export {
  DOMINION_VERSION,
  CK_SALT,
  KIND_VAULT_SHARE,
  KIND_VAULT_CONFIG,
  PROTOCOL_LABEL,
  LEGACY_PROTOCOL_LABEL,
  DEFAULT_EPOCH_LENGTH,
} from './constants.js';

// Content keys
export { deriveContentKey, contentKeyToHex, getCurrentEpochId, getEpochIdForDate } from './content-keys.js';

// Encryption
export { encrypt, decrypt, encryptBlob, decryptBlob } from './encrypt.js';

// Shamir secret sharing
export { splitSecret, combineShares } from './shamir.js';

// CK splitting
export { splitCK, reconstructCK, encodeCKShare, decodeCKShare } from './shamir-keys.js';

// Config mutations
export {
  defaultConfig,
  addToTier,
  removeFromTier,
  addIndividualGrant,
  removeIndividualGrant,
  revokePubkey,
  unrevokePubkey,
} from './config.js';
