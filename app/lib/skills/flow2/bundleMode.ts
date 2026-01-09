/**
 * Phase 3.3: Bundle Mode Parser
 *
 * Controls which code path is executed and what result is returned.
 * Decouples "bundle readable" (FLOW2_SKILL_REGISTRY) from "bundle returned".
 *
 * Modes:
 * - legacy: Compute and return legacy only (DEFAULT)
 * - shadow: Compute both, compare stable fields, return legacy (validation only)
 * - active: Compute and return bundle (with error fallback to legacy)
 *
 * Safety:
 * - Defaults to 'legacy' on unset/invalid values
 * - No mutation of process.env
 * - Explicit mode checks for clarity
 *
 * Phase 3.3.1: Added guardrails for mode + registry compatibility
 */

export type Flow2BundleMode = 'legacy' | 'shadow' | 'active';

// Phase 3.3.1: One-time warning flag for misconfiguration
let hasWarnedMisconfiguration = false;

/**
 * Phase 3.3.1: Check if bundles can be used
 * Returns true only if FLOW2_SKILL_REGISTRY is explicitly set to 'true'
 */
function canUseBundles(): boolean {
  return process.env.FLOW2_SKILL_REGISTRY === 'true';
}

/**
 * Phase 3.3.1: Check if legacy comparison should run in active mode
 * Default: false (no comparison to reduce CPU overhead)
 * Set FLOW2_BUNDLE_COMPARE=true to enable legacy comparison logging in active mode
 */
export function shouldCompareLegacyInActive(): boolean {
  return process.env.FLOW2_BUNDLE_COMPARE === 'true';
}

/**
 * Get current bundle mode from environment
 * Defaults to 'legacy' if unset or invalid
 *
 * Phase 3.3: Single source of truth for mode determination
 * Phase 3.3.1: Added guardrail for mode + registry compatibility
 */
export function getFlow2BundleMode(): Flow2BundleMode {
  const envValue = process.env.FLOW2_BUNDLE_MODE;

  // Unset → legacy (default)
  if (!envValue) {
    return 'legacy';
  }

  // Validate against allowed values
  const normalized = envValue.toLowerCase().trim();
  if (normalized === 'shadow' || normalized === 'active' || normalized === 'legacy') {
    // Phase 3.3.1: Guardrail - check mode + registry compatibility
    if ((normalized === 'shadow' || normalized === 'active') && !canUseBundles()) {
      // Force legacy when shadow/active requested but SKILL_REGISTRY disabled
      if (!hasWarnedMisconfiguration) {
        console.warn(
          `[Flow2] BUNDLE_MODE requested (${normalized}) but SKILL_REGISTRY disabled; forcing legacy.`
        );
        hasWarnedMisconfiguration = true;
      }
      return 'legacy';
    }

    return normalized as Flow2BundleMode;
  }

  // Invalid value → legacy (safe default)
  console.warn(
    `[BundleMode] Invalid FLOW2_BUNDLE_MODE="${envValue}". Defaulting to "legacy".`
  );
  return 'legacy';
}

/**
 * Check if in shadow mode
 * Shadow mode: Compute both legacy and bundle, compare, return legacy
 */
export function isShadowMode(): boolean {
  return getFlow2BundleMode() === 'shadow';
}

/**
 * Check if in active mode
 * Active mode: Compute and return bundle (with error fallback to legacy)
 */
export function isActiveMode(): boolean {
  return getFlow2BundleMode() === 'active';
}

/**
 * Check if in legacy mode
 * Legacy mode: Compute and return legacy only (default)
 */
export function isLegacyMode(): boolean {
  return getFlow2BundleMode() === 'legacy';
}

/**
 * Get human-readable mode description
 * Useful for logging and debugging
 */
export function getBundleModeDescription(): string {
  const mode = getFlow2BundleMode();

  switch (mode) {
    case 'legacy':
      return 'Legacy only (default)';
    case 'shadow':
      return 'Shadow-run validation (compute both, return legacy)';
    case 'active':
      return 'Active bundle (compute and return bundle)';
    default:
      return 'Unknown mode';
  }
}
