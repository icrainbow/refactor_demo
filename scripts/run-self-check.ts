#!/usr/bin/env tsx
/**
 * Phase 4: Simplified Self-Check Script
 *
 * Validates essential files exist.
 *
 * Usage:
 *   FLOW2_SELF_CHECK_MODE=fail npm run gate:selfcheck   # Dev mode (fail-fast)
 *   FLOW2_SELF_CHECK_MODE=warn npm run gate:selfcheck   # Prod mode (warn-only)
 */

import { runStartupSelfCheck, type SelfCheckResult } from '../app/lib/skills/startupSelfCheck';

// ========================================
// CONFIGURATION
// ========================================

const SELF_CHECK_MODE = (process.env.FLOW2_SELF_CHECK_MODE === 'warn' ? 'prod' : 'dev') as 'dev' | 'prod';

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 4: Self-Check (Simplified)                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`[Config] FLOW2_SELF_CHECK_MODE: ${SELF_CHECK_MODE}\n`);

  try {
    // Step 1: Run validation functions
    console.log('[Step 1/3] Running self-check validations...');
    const result = runStartupSelfCheck(SELF_CHECK_MODE);

    // Step 2: Display results
    console.log('\n[Step 2/3] Validation Results:');
    displayResults(result);

    // Step 3: Exit with appropriate code
    console.log('\n[Step 3/3] Final Status:');
    if (result.ok) {
      console.log('✅ SELF-CHECK PASSED - All essential files exist\n');
      process.exit(0);
    } else {
      if (SELF_CHECK_MODE === 'dev') {
        console.error('❌ SELF-CHECK FAILED - See errors above\n');
        process.exit(1);
      } else {
        console.warn('⚠️  SELF-CHECK WARNINGS - Errors logged, continuing with fallback\n');
        process.exit(0);
      }
    }
  } catch (error: any) {
    console.error('\n❌ SELF-CHECK EXECUTION FAILED');
    console.error(`Error: ${error.message}\n`);

    if (SELF_CHECK_MODE === 'dev') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing with legacy fallback (prod mode)\n');
      process.exit(0);
    }
  }
}

// ========================================
// DISPLAY HELPERS
// ========================================

function displayResults(result: SelfCheckResult) {
  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('  ✅ No issues found');
    return;
  }

  if (result.errors.length > 0) {
    console.log(`\n  ❌ ERRORS (${result.errors.length}):`);
    result.errors.forEach((error, idx) => {
      console.log(`    ${idx + 1}. ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log(`\n  ⚠️  WARNINGS (${result.warnings.length}):`);
    result.warnings.forEach((warning, idx) => {
      console.log(`    ${idx + 1}. ${warning}`);
    });
  }
}

// ========================================
// ENTRY POINT
// ========================================

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
