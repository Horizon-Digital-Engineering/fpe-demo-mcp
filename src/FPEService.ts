/*
 * Copyright (c) 2025 Horizon Digital Engineering LLC
 * Licensed under the Business Source License 1.1 (BSL).
 * See the LICENSE file in the project root for details.
 */

// Real FPE service using MYSTO FF3 library
import { createRequire } from 'module';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
const require = createRequire(import.meta.url);
const FF3Cipher = require('ff3/lib/FF3Cipher') as new (key: string, tweak: string, radix: number) => FF3CipherInstance;

// Interface for the FF3Cipher instance (no official types available)
interface FF3CipherInstance {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

// FF3 constants for radix-10 (digits only)
const RADIX = 10;            // digits only
const MIN_LENGTH = 6;        // mysto/FF3 practical min for radix-10
const MAX_LENGTH = 56;       // FF3 limit for radix-10

class FPEService {
  // Canonical tool descriptions (used by both stdio and HTTP servers)
  static readonly TOOL_DESCRIPTIONS = {
    fpe_encrypt: {
      description: 'Encrypt digits using FF3 Format Preserving Encryption. MYSTO FF3 LIMITATIONS: radix-10 only (digits 0-9), 6-56 digit length range, no mixed formats (e.g., A123456 cannot preserve letter+digits). Input normalized to digits only - all non-digits stripped. Returns ENC_FPE:digits format. NO format reconstruction. Example: "123-45-6789" → normalize to "123456789" → encrypt → "ENC_FPE:096616337"',
      inputDescription: 'Input containing digits to encrypt. Non-digits automatically stripped during normalization. Must result in 6-56 digits after normalization for MYSTO FF3 limits. Output will be pure digits only - no formatting preserved.'
    },
    fpe_decrypt: {
      description: 'Decrypt FF3-encrypted digits back to original digits. Only works with ENC_FPE:digits format from fpe_encrypt tool. Returns pure digits only - no formatting. If you need formatted output, you must reconstruct it yourself from the returned digits.',
      inputDescription: 'Previously encrypted value in ENC_FPE:digits format from fpe_encrypt tool. Must contain only digits after the prefix. Example: "ENC_FPE:096616337" returns "123456789"'
    }
  };

  private cipher: FF3CipherInstance;
  private key: string;
  private tweak: string;

  constructor(key?: string, tweak?: string) {
    // Use environment variables first, then fallback to demo keys
    this.key = key || process.env.FPE_KEY || "EF4359D8D580AA4F7F036D6F04FC6A94"; // 128-bit key
    this.tweak = tweak || process.env.FPE_TWEAK || "D8E7920AFA330A73"; // 64-bit tweak
    
    try {
      this.cipher = new FF3Cipher(this.key, this.tweak, RADIX);
    } catch (error) {
      console.error('Failed to initialize FF3 cipher:', error);
      throw new McpError(ErrorCode.InvalidParams,'FPE service initialization failed');
    }
  }

  // Check if value is already encrypted (has ENC_FPE: prefix)
  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith('ENC_FPE:');
  }

  // Normalize input to digits only for FF3 radix-10
  private normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  // Add ENC_FPE prefix to encrypted value
  private tag(encryptedDigits: string): string {
    return `ENC_FPE:${encryptedDigits}`;
  }

  // Real FPE encrypt using FF3 algorithm with ENC_ prefix for beginners
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new McpError(ErrorCode.InvalidParams,"Cannot encrypt empty value");
    }

    // Guard: Don't double-encrypt (idempotency)
    if (this.isEncrypted(plaintext)) {
      return plaintext;
    }

    // Step 1: Normalize - extract only digits for FF3 radix-10 domain
    const digits = this.normalizeDigits(plaintext);
    if (!/^[0-9]+$/.test(digits)) {
      throw new McpError(ErrorCode.InvalidParams,"FPE radix-10 requires digits only");
    }
    if (digits.length < MIN_LENGTH || digits.length > MAX_LENGTH) {
      throw new McpError(ErrorCode.InvalidParams,`FPE length must be ${MIN_LENGTH}-${MAX_LENGTH} digits (got ${digits.length})`);
    }

    try {
      // Step 2: Apply real FF3 FPE to normalized digits
      const encryptedDigits = this.cipher.encrypt(digits);
      
      // Step 3: Return encrypted digits with ENC_FPE: prefix (no format reconstruction)
      return this.tag(encryptedDigits);
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams,`FPE encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Real FPE decrypt using FF3 algorithm
  decrypt(encrypted: string): string {
    if (!encrypted) {
      throw new McpError(ErrorCode.InvalidParams,"Cannot decrypt empty value");
    }

    // Guard: Check for ENC_FPE: prefix (validate input)
    if (!this.isEncrypted(encrypted)) {
      throw new McpError(ErrorCode.InvalidParams,"Value does not appear to be encrypted (missing ENC_FPE: prefix)");
    }

    // Step 1: Remove ENC_FPE: prefix to get encrypted digits
    const encryptedDigits = encrypted.substring(8); // Remove "ENC_FPE:"

    // Step 2: Validate we have digits only (no formatting should be present)
    if (!/^\d+$/.test(encryptedDigits)) {
      throw new McpError(ErrorCode.InvalidParams,"Invalid encrypted format - expected digits only after ENC_FPE:");
    }

    try {
      // Step 3: Apply real FF3 FPE decryption to get original digits
      const decryptedDigits = this.cipher.decrypt(encryptedDigits);
      
      // Step 4: Return pure digits (no format reconstruction)
      return decryptedDigits;
    } catch (error) {
      throw new McpError(ErrorCode.InvalidParams,`FPE decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export { FPEService };