/**
 * Skills Framework - Startup Self-Check
 *
 * Phase 4: Simplified validation without bundle loader
 * Basic startup checks only
 */

import fs from 'fs';
import path from 'path';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface SelfCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Function 1: Check Essential Files Exist
 *
 * Validates that essential files are present
 */
export function checkEssentialFilesExist(): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const essentialFiles = [
    'app/lib/graphKyc/riskTriage.ts',
    'app/lib/graphKyc/topicAssembler.ts',
    'app/lib/topicSummaries/topicSetResolver.ts',
  ];

  for (const file of essentialFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Essential file not found: ${file}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// ========================================
// MASTER SELF-CHECK
// ========================================

/**
 * Run basic validation checks
 *
 * @param mode - 'dev' (fail-fast) or 'prod' (warn + fallback)
 */
export function runStartupSelfCheck(mode: 'dev' | 'prod'): SelfCheckResult {
  const results = [
    checkEssentialFilesExist(),
  ];

  const allErrors = results.flatMap((r) => r.errors);
  const allWarnings = results.flatMap((r) => r.warnings);

  if (mode === 'dev') {
    // Dev: Fail-fast on any error
    if (allErrors.length > 0) {
      console.error('[SelfCheck/Dev] FAILED:\n' + allErrors.join('\n'));
      throw new Error(`Self-check failed: ${allErrors.length} error(s)`);
    }
    if (allWarnings.length > 0) {
      console.warn('[SelfCheck/Dev] Warnings:\n' + allWarnings.join('\n'));
    }
  } else if (mode === 'prod') {
    // Prod: Log errors, send alert, return for fallback
    if (allErrors.length > 0) {
      console.error('[SelfCheck/Prod] CRITICAL errors:', allErrors);
      // TODO: Send alert to monitoring (Sentry, CloudWatch, etc.)
      // sendAlert('Self-check validation failed in production', { errors: allErrors });
    }
    if (allWarnings.length > 0) {
      console.warn('[SelfCheck/Prod] Warnings:', allWarnings);
    }
  }

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
