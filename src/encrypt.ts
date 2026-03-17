import { gcm } from '@noble/ciphers/aes.js';
import { utf8ToBytes, bytesToUtf8, randomBytes } from '@noble/ciphers/utils.js';

const IV_LENGTH = 12;

/** Portable base64 encode (no Buffer dependency). */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Portable base64 decode (no Buffer dependency). */
function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encrypt a plaintext string with a 32-byte Content Key.
 * Returns base64(iv || ciphertext || tag).
 */
export function encrypt(plaintext: string, ck: Uint8Array): string {
  const raw = encryptBlob(utf8ToBytes(plaintext), ck);
  return toBase64(raw);
}

/**
 * Decrypt a base64(iv || ciphertext || tag) string with a 32-byte Content Key.
 */
export function decrypt(ciphertext: string, ck: Uint8Array): string {
  const raw = fromBase64(ciphertext);
  const decrypted = decryptBlob(raw, ck);
  return bytesToUtf8(decrypted);
}

/**
 * Encrypt a Uint8Array with a 32-byte Content Key.
 * Returns Uint8Array(iv || ciphertext || tag).
 */
export function encryptBlob(data: Uint8Array, ck: Uint8Array): Uint8Array {
  if (ck.length !== 32) throw new Error('Content key must be 32 bytes');
  const iv = randomBytes(IV_LENGTH);
  const aes = gcm(ck, iv);
  const encrypted = aes.encrypt(data);
  const result = new Uint8Array(IV_LENGTH + encrypted.length);
  result.set(iv, 0);
  result.set(encrypted, IV_LENGTH);
  return result;
}

/**
 * Decrypt a Uint8Array(iv || ciphertext || tag) with a 32-byte Content Key.
 */
export function decryptBlob(encrypted: Uint8Array, ck: Uint8Array): Uint8Array {
  if (ck.length !== 32) throw new Error('Content key must be 32 bytes');
  if (encrypted.length < IV_LENGTH + 16) throw new Error('Ciphertext too short');
  const iv = encrypted.slice(0, IV_LENGTH);
  const ciphertext = encrypted.slice(IV_LENGTH);
  const aes = gcm(ck, iv);
  return aes.decrypt(ciphertext);
}
