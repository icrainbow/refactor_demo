#!/usr/bin/env tsx
/**
 * Phase 2 - Gate 2: Self-Check Script
 *
 * Validates bundle integrity without loading into runtime.
 * Reads bundles from filesystem and runs all 5 validation functions.
 *
 * Usage:
 *   FLOW2_SELF_CHECK_MODE=fail npm run gate:selfcheck   # Dev mode (fail-fast)
 *   FLOW2_SELF_CHECK_MODE=warn npm run gate:selfcheck   # Prod mode (warn-only)
 */

import { loadAllBundles } from '../app/lib/skills/bundleLoader';
import { runStartupSelfCheck, type SelfCheckResult } from '../app/lib/skills/startupSelfCheck';

// ========================================
// CONFIGURATION
// ========================================

const SELF_CHECK_MODE = (process.env.FLOW2_SELF_CHECK_MODE === 'warn' ? 'prod' : 'dev') as 'dev' | 'prod';
const ENABLE_BUNDLES = process.env.FLOW2_SKILL_REGISTRY === 'true';

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 2 - Gate 2: Skill Bundle Self-Check                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`[Config] FLOW2_SKILL_REGISTRY: ${ENABLE_BUNDLES ? 'TRUE' : 'FALSE'}`);
  console.log(`[Config] FLOW2_SELF_CHECK_MODE: ${SELF_CHECK_MODE}\n`);

  // Phase 2: Bundles NOT enabled in runtime, but we enable temporarily for validation
  if (!ENABLE_BUNDLES) {
    console.log('[Phase 2] Enabling bundles temporarily for validation only...');
    process.env.FLOW2_SKILL_REGISTRY = 'true';
  }

  try {
    // Step 1: Load bundles
    console.log('[Step 1/5] Loading governance bundles...');
    const bundles = loadAllBundles();
    console.log('✓ Bundles loaded successfully\n');

    // Step 2: Run all 5 validation functions
    console.log('[Step 2/5] Running self-check validations...');
    const result = runStartupSelfCheck(SELF_CHECK_MODE, bundles);

    // Step 3: Display results
    console.log('\n[Step 3/5] Validation Results:');
    displayResults(result);

    // Step 4: Summary
    console.log('\n[Step 4/5] Summary:');
    console.log(`  Routes validated: ${bundles.routing.routes.length}`);
    console.log(`  Topics validated: ${bundles.topicCatalog.topics.length}`);
    console.log(`  Policies validated: ${bundles.policyBundle.policies.length}`);
    console.log(`  Templates validated: ${Object.keys(bundles.templates).filter(k => bundles.templates[k as keyof typeof bundles.templates]).length}`);

    // Step 5: Exit with appropriate code
    console.log('\n[Step 5/5] Final Status:');
    if (result.ok) {
      console.log('✅ SELF-CHECK PASSED - All bundles valid\n');
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
  } finally {
    // Restore original env var state
    if (!ENABLE_BUNDLES) {
      delete process.env.FLOW2_SKILL_REGISTRY;
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
