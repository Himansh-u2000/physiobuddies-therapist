import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { STORAGE_KEYS } from "@/constants/config";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One 256-bit key per device install, generated once and kept in the OS keystore/keychain
 * (never sent over the network, never logged). Survives logout/login on the same device —
 * this isn't a session artifact, it's what keeps the local cache readable at all. Losing it
 * (app reinstall, which clears SecureStore) makes the existing SQLite file unreadable, which
 * is fine: it's an offline cache/sync queue, not the source of truth, and the migration
 * runner just recreates it empty against a fresh key.
 */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STORAGE_KEYS.dbEncryptionKey);
  if (existing) return existing;

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = toHex(bytes);
  await SecureStore.setItemAsync(STORAGE_KEYS.dbEncryptionKey, key);
  return key;
}

/**
 * SQLCipher's raw-key form (`x'<64 hex chars>'`) skips PBKDF2 passphrase derivation
 * entirely — faster than a text passphrase, and there's no passphrase string to escape.
 * Must be the first statement run against a freshly opened connection.
 */
export function sqlCipherKeyPragma(hexKey: string): string {
  return `PRAGMA key = "x'${hexKey}'";`;
}
