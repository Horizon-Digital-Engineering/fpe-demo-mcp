// FPEService test - understand pure digit behavior and FF3 limits

import { FPEService } from '../src/FPEService.js';

function testFPEService() {
  console.log('\n=== FPEService Pure Digit Test Suite ===\n');
  
  const fpe = new FPEService();

  // Test 1: Pure digits round-trip
  console.log('1. Pure Digits Round-trip:');
  try {
    const original = '123456789';
    const encrypted = fpe.encrypt(original);
    const decrypted = fpe.decrypt(encrypted);
    console.log(`  Original:  ${original}`);
    console.log(`  Encrypted: ${encrypted}`);
    console.log(`  Decrypted: ${decrypted}`);
    console.log(`  Success:   ${original === decrypted ? '✅' : '❌'}\n`);
  } catch (error) {
    console.log(`  Error: ${error}\n`);
  }

  // Test 2: Normalization (strips non-digits)
  console.log('2. Input Normalization (strips non-digits):');
  const normalizeTests = [
    '123-45-6789',      // SSN format
    '(555) 123-4567',   // Phone format  
    '4000 1234 5678 9999', // Credit card with spaces
    'abc123def456',     // Mixed alphanumeric
    '12.34.56',         // Dots
  ];

  normalizeTests.forEach(test => {
    try {
      const encrypted = fpe.encrypt(test);
      const decrypted = fpe.decrypt(encrypted);
      const normalized = test.replace(/\D/g, '');
      console.log(`  "${test}" → normalized: "${normalized}" → encrypted: ${encrypted} → decrypted: "${decrypted}"`);
      console.log(`    Success: ${normalized === decrypted ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`  "${test}" → Error: ${error instanceof Error ? error.message : 'Unknown error'} ❌`);
    }
  });
  console.log();

  // Test 3: FF3 Minimum length requirement
  console.log('3. FF3 Minimum Length (requires ≥6 digits for MYSTO FF3):');
  const minTests = ['', '1', '12', '123', '1234', '12345', '123456'];
  minTests.forEach(test => {
    try {
      const encrypted = fpe.encrypt(test);
      console.log(`  "${test}" (${test.length} digits) → ${encrypted} ✅`);
    } catch (error) {
      console.log(`  "${test}" (${test.length} digits) → Error: ${error instanceof Error ? error.message : 'Unknown error'} ❌`);
    }
  });
  console.log();

  // Test 4: FF3 Maximum length limits  
  console.log('4. FF3 Maximum Length Limits:');
  const maxTests = [
    '12',                           // 2 digits
    '123456789',                    // 9 digits (SSN)
    '1234567890123456',             // 16 digits (Credit card)
    '12345678901234567890',         // 20 digits
    '123456789012345678901234567890', // 30 digits
    '1'.repeat(50),                 // 50 digits
    '1'.repeat(56),                 // 56 digits - documented FF3 max for radix-10
    '1'.repeat(57),                 // 57 digits - should fail
    '1'.repeat(100),                // 100 digits - definitely too big
  ];

  maxTests.forEach(test => {
    try {
      const start = Date.now();
      const encrypted = fpe.encrypt(test);
      const decrypted = fpe.decrypt(encrypted);
      const time = Date.now() - start;
      const success = test === decrypted;
      console.log(`  ${test.length.toString().padEnd(3)} digits → ${success ? '✅' : '❌'} (${time}ms)`);
      if (!success) {
        console.log(`    Expected: ${test}`);
        console.log(`    Got:      ${decrypted}`);
      }
    } catch (error) {
      console.log(`  ${test.length.toString().padEnd(3)} digits → ❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  console.log();

  // Test 5: Idempotency (don't double-encrypt)
  console.log('5. Idempotency (no double-encryption):');
  try {
    const original = '123456789';
    const encrypted1 = fpe.encrypt(original);
    const encrypted2 = fpe.encrypt(encrypted1); // Should return same
    console.log(`  Original:         ${original}`);
    console.log(`  First encrypt:    ${encrypted1}`);
    console.log(`  Second encrypt:   ${encrypted2}`);
    console.log(`  Idempotent:       ${encrypted1 === encrypted2 ? '✅' : '❌'}\n`);
  } catch (error) {
    console.log(`  Error: ${error}\n`);
  }

  // Test 6: Invalid encrypted format
  console.log('6. Invalid Encrypted Format Handling:');
  const invalidEncrypted = [
    'ENC_FPE:123abc456',  // Non-digits after prefix
    'ENC_FPE:',           // Empty after prefix
    'WRONG_PREFIX:123',   // Wrong prefix
    '123456',             // No prefix
  ];

  invalidEncrypted.forEach(test => {
    try {
      const decrypted = fpe.decrypt(test);
      console.log(`  "${test}" → "${decrypted}" ❌ (should have failed)`);
    } catch (error) {
      console.log(`  "${test}" → Error: ${error instanceof Error ? error.message : 'Unknown error'} ✅`);
    }
  });
  console.log();

  console.log('=== Key Findings ===');
  console.log('• MYSTO FF3 limitation: radix-10 only (digits 0-9)');
  console.log('• Input normalization: strips all non-digits');
  console.log('• Output format: ENC_FPE:digits (no formatting preserved)');
  console.log('• Minimum: 6 digits required for MYSTO FF3 (not standard FF3)');
  console.log('• Maximum: 56 digits per FF3 spec for radix-10, 57+ digits fail');
  console.log('• Format reconstruction: User/LLM responsibility');

  console.log('\n=== Test Complete ===');
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFPEService();
}