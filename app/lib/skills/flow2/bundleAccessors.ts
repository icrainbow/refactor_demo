/**
 * Phase 3.1: Bundle Accessors (Deterministic Assets)
 *
 * Single source of truth for accessing governance bundles.
 * All runtime code should use these accessors (NOT direct imports from bundleLoader).
 *
 * Safety:
 * - Defaults to disabled (flags=false)
 * - Returns null when disabled → forces legacy fallback
 * - Dev: fail-fast on validation errors
 * - Prod: warn + return null (graceful degradation)
 */

import type {
  LoadedBundles,
  RoutingConfig,
  TopicCatalog,
  PolicyBundle,
  PromptsBundle
} from '../bundleLoader';
import { loadBundlesRuntimeSafe, hasStaticImports } from '../bundleStaticLoader';
import { runStartupSelfCheck } from '../startupSelfCheck';
import { validateFlow2TopicCatalog, formatValidationResult } from './topicCatalogValidator';

// ========================================
// FEATURE FLAG HELPERS
// ========================================

/**
 * Check if skill registry enabled
 * Master kill switch for ALL bundle features
 */
export function isSkillRegistryEnabled(): boolean {
  return process.env.FLOW2_SKILL_REGISTRY === 'true';
}

/**
 * Check if shadow-run enabled (dev only)
 */
export function isShadowRunEnabled(): boolean {
  return process.env.FLOW2_SHADOW_RUN === 'true';
}

/**
 * Check if templates bundle enabled
 * Phase 3.2 feature flag
 */
export function isTemplatesBundleEnabled(): boolean {
  return process.env.FLOW2_TEMPLATES_BUNDLE === 'true';
}

/**
 * Check if prompts bundle enabled
 * Phase 3.3 feature flag
 */
export function isPromptsBundleEnabled(): boolean {
  return process.env.FLOW2_PROMPTS_BUNDLE === 'true';
}

// ========================================
// BUNDLE CACHE (Singleton)
// ========================================

let cachedBundles: LoadedBundles | null = null;
let cacheInitialized = false;

/**
 * Load and cache bundles with validation
 * Only called once per process lifecycle
 *
 * Returns null if:
 * - Skill registry disabled (unless forceEnable=true)
 * - Load/validation fails (prod only; dev throws)
 *
 * @param forceEnable - Phase 3.2: Force bundle loading for shadow-run (INTERNAL USE ONLY)
 */
function loadAndCacheBundles(forceEnable: boolean = false): LoadedBundles | null {
  // Already attempted load
  if (cacheInitialized && !forceEnable) {
    return cachedBundles;
  }

  // Master kill switch (unless forceEnable for shadow-run)
  if (!isSkillRegistryEnabled() && !forceEnable) {
    cacheInitialized = true;
    cachedBundles = null;
    return null;
  }

  // Phase 3.2: For shadow-run, load bundles directly without caching
  if (forceEnable && !isSkillRegistryEnabled()) {
    // Shadow-run mode: load bundles without updating cache
    try {
      const bundles = loadBundlesRuntimeSafe();
      return bundles;
    } catch (error: any) {
      console.warn('[BundleAccessors] Shadow-run bundle load failed:', error.message);
      return null;
    }
  }

  try {
    console.log('[BundleAccessors] Loading bundles...');

    // Load bundles (runtime-safe)
    const bundles = loadBundlesRuntimeSafe();

    // Phase 3.4 Batch 5: Validate topic catalog structure
    const mode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    if (bundles?.topicCatalog) {
      const validationResult = validateFlow2TopicCatalog(bundles.topicCatalog);

      if (!validationResult.ok) {
        console.warn('[FLOW2][TOPIC_CATALOG][VALIDATION] Validation failed');
        console.warn(formatValidationResult(validationResult));

        if (mode === 'dev') {
          // Dev: fail-fast on validation errors
          throw new Error(
            `Topic catalog validation failed: ${validationResult.errors.join(', ')}`
          );
        } else {
          // Prod: warn + return null (graceful degradation)
          console.warn('[BundleAccessors] Topic catalog invalid, forcing legacy fallback');
          cachedBundles = null;
          cacheInitialized = true;
          return null;
        }
      }

      // Log warnings even if validation passed
      if (validationResult.warnings.length > 0) {
        console.warn('[FLOW2][TOPIC_CATALOG][VALIDATION] Warnings:');
        validationResult.warnings.forEach(w => console.warn(`  - ${w}`));
      }
    }

    // Run self-check validation
    const selfCheckResult = runStartupSelfCheck(mode, bundles);

    if (!selfCheckResult.ok) {
      if (mode === 'dev') {
        // Dev: fail-fast
        throw new Error(
          `Bundle self-check failed: ${selfCheckResult.errors.join(', ')}`
        );
      } else {
        // Prod: warn + return null (graceful degradation)
        console.warn('[BundleAccessors] Self-check failed, forcing legacy fallback');
        console.warn('[BundleAccessors] Errors:', selfCheckResult.errors);
        cachedBundles = null;
        cacheInitialized = true;
        return null;
      }
    }

    console.log('[BundleAccessors] ✓ Bundles loaded and validated');
    cachedBundles = bundles;
    cacheInitialized = true;
    return bundles;
  } catch (error: any) {
    const mode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

    if (mode === 'dev') {
      // Dev: fail-fast
      console.error('[BundleAccessors] FAILED:', error.message);
      throw error;
    } else {
      // Prod: warn + force legacy
      console.warn('[BundleAccessors] Load failed, forcing legacy fallback');
      console.warn('[BundleAccessors] Error:', error.message);
      cachedBundles = null;
      cacheInitialized = true;
      return null;
    }
  }
}

// ========================================
// PUBLIC ACCESSORS (Phase 3.1)
// ========================================

/**
 * Get topic catalog (8-topic governance)
 * Returns null if disabled or load failed → use legacy 7-topic constants
 *
 * Phase 3.2: Added forceEnable for shadow-run
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2TopicCatalog(forceEnable: boolean = false): TopicCatalog | null {
  const bundles = loadAndCacheBundles(forceEnable);
  return bundles?.topicCatalog || null;
}

/**
 * Get policy bundle (triage, scoring, thresholds, keywords)
 * Returns null if disabled → use legacy hardcoded rules
 *
 * Phase 3.2: Added forceEnable for shadow-run
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2PolicyBundle(forceEnable: boolean = false): PolicyBundle | null {
  const bundles = loadAndCacheBundles(forceEnable);
  return bundles?.policyBundle || null;
}

/**
 * Get routing config (route_id → handler mapping)
 * Returns null if disabled → routing not used yet in Phase 3.1
 */
export function getFlow2RoutingConfig(): RoutingConfig | null {
  const bundles = loadAndCacheBundles();
  return bundles?.routing || null;
}

/**
 * Get prompts bundle (Phase 3.3)
 * Returns null if disabled or Phase 3.3 not yet active
 */
export function getFlow2PromptsBundle(): PromptsBundle | null {
  if (!isPromptsBundleEnabled()) {
    return null;
  }

  const bundles = loadAndCacheBundles();
  return bundles?.promptsBundle || null;
}

/**
 * Get email templates (Phase 3.2)
 * Returns null if disabled or Phase 3.2 not yet active
 */
export function getFlow2EmailTemplates(): LoadedBundles['templates'] | null {
  if (!isTemplatesBundleEnabled()) {
    return null;
  }

  const bundles = loadAndCacheBundles();
  return bundles?.templates || null;
}

// ========================================
// CONVENIENCE ACCESSORS (Phase 3.1 Batch 3-5)
// ========================================

/**
 * Get critical topic IDs from topic catalog
 * Returns null if disabled → use legacy CRITICAL_TOPICS constant
 *
 * Phase 3.1 Batch 3: Used by riskTriage.ts for coverage checks
 * Phase 3.2: Added forceEnable for shadow-run
 *
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2CriticalTopicIds(forceEnable: boolean = false): string[] | null {
  const catalog = getFlow2TopicCatalog(forceEnable);
  if (!catalog || !catalog.critical_flags) {
    return null; // Disabled → use legacy
  }
  return catalog.critical_flags.ids;
}

/**
 * Get high-risk keywords from policy bundle
 * Returns null if disabled → use legacy HIGH_RISK_KEYWORDS constant
 *
 * Phase 3.1 Batch 4: Used by topicAssembler.ts for keyword detection
 * Phase 3.2: Added forceEnable for shadow-run
 *
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2HighRiskKeywords(forceEnable: boolean = false): string[] | null {
  const policy = getFlow2PolicyBundle(forceEnable);
  if (!policy || !policy.high_risk_keywords) {
    return null; // Disabled → use legacy
  }
  return policy.high_risk_keywords;
}

/**
 * Get triage scoring rules from policy bundle
 * Returns null if disabled → use legacy hardcoded scoring
 *
 * Phase 3.1 Batch 5: Used by riskTriage.ts for risk score calculation
 * Phase 3.2: Added forceEnable for shadow-run
 *
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2TriageScoringRules(forceEnable: boolean = false): {
  missing_critical_topic: number;
  missing_non_critical_topic: number;
  high_risk_keyword_multiplier: number;
} | null {
  const policy = getFlow2PolicyBundle(forceEnable);
  if (!policy || !policy.triage || !policy.triage.scoring_rules) {
    return null; // Disabled → use legacy
  }
  return policy.triage.scoring_rules;
}

/**
 * Get routing thresholds from policy bundle
 * Returns null if disabled → use legacy hardcoded thresholds
 *
 * Phase 3.1 Batch 5: Used by riskTriage.ts for path routing
 * Phase 3.2: Added forceEnable for shadow-run
 *
 * @param forceEnable - INTERNAL: Force bundle loading for shadow-run comparison
 */
export function getFlow2RoutingThresholds(forceEnable: boolean = false): {
  fast: [number, number];
  crosscheck: [number, number];
  escalate: [number, number];
  human_gate: [number, number];
} | null {
  const policy = getFlow2PolicyBundle(forceEnable);
  if (!policy || !policy.triage || !policy.triage.routing_thresholds) {
    return null; // Disabled → use legacy
  }
  return policy.triage.routing_thresholds;
}

// ========================================
// CACHE CONTROL (Testing/Scripts)
// ========================================

/**
 * Clear bundle cache (for testing/scripts only)
 * NOT for production runtime use
 */
export function clearBundleCache(): void {
  cachedBundles = null;
  cacheInitialized = false;
  console.log('[BundleAccessors] Cache cleared');
}

/**
 * Force reload bundles (for testing/scripts only)
 * NOT for production runtime use
 */
export function reloadBundles(): LoadedBundles | null {
  clearBundleCache();
  return loadAndCacheBundles();
}
