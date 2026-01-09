/**
 * Phase 3.4: Topic Set Resolver
 *
 * Pure deterministic resolver for route-specific topic sets.
 * Supports both legacy hardcoded sources and bundle YAML sources.
 *
 * Safety:
 * - No behavior change in legacy mode (FLOW2_BUNDLE_MODE unset or =legacy)
 * - Fallback to legacy on any bundle errors
 * - No server-only imports (client-safe)
 */

import { getFlow2BundleMode } from '../skills/flow2/bundleMode';
import { getFlow2TopicCatalog } from '../skills/flow2/bundleAccessors';

/**
 * Route identifier for topic set resolution
 * Maps to different review workflows
 */
export type Flow2RouteId =
  | 'kyc_review'
  | 'case2_review'
  | 'it_review'
  | 'guardrail_check'
  | 'chat_general'
  | string; // Allow extensibility

/**
 * Resolved topic set with metadata
 */
export interface TopicSet {
  /** List of topic IDs for this route */
  topic_ids: string[];
  /** Optional title mappings (if available from source) */
  titles?: Record<string, string>;
  /** Source of the topic set (for debugging/logging) */
  source: 'legacy' | 'bundle';
}

/**
 * Options for topic set resolution
 * @internal - forceBundle is for shadow-run comparison only
 */
export interface ResolveOptions {
  /** Force bundle loading even when SKILL_REGISTRY=false (shadow-run only) */
  forceBundle?: boolean;
}

// ========================================
// PHASE 3.4 BATCH 3: SHADOW COMPARISON
// ========================================

/**
 * Deduplication set for shadow mismatch logs
 * Prevents duplicate warnings for same mismatch signature
 */
const EMITTED_SHADOW_KEYS = new Set<string>();

/**
 * Deduplication set for active fallback warnings
 * Phase 3.4 Batch 4: Prevents duplicate fallback warnings in active mode
 */
const EMITTED_ACTIVE_FALLBACK_KEYS = new Set<string>();

/**
 * Compare two topic ID arrays for exact order equality
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

/**
 * Compute diff between legacy and bundle topic ID arrays
 */
function diffArrays(legacyIds: string[], bundleIds: string[]) {
  const legacySet = new Set(legacyIds);
  const bundleSet = new Set(bundleIds);

  const missingInBundle = legacyIds.filter(id => !bundleSet.has(id));
  const extraInBundle = bundleIds.filter(id => !legacySet.has(id));
  const orderDiff = legacySet.size === bundleSet.size &&
                    missingInBundle.length === 0 &&
                    extraInBundle.length === 0 &&
                    !arraysEqual(legacyIds, bundleIds);

  return { missingInBundle, extraInBundle, orderDiff };
}

/**
 * Create stable key for deduplication
 */
function makeShadowKey(
  routeId: string,
  missing: string[],
  extra: string[],
  orderDiff: boolean,
  legacyCount: number,
  bundleCount: number
): string {
  return `${routeId}|l${legacyCount}|b${bundleCount}|m:${missing.join(',')}|e:${extra.join(',')}|o:${orderDiff}`;
}

/**
 * Log shadow mismatch with deduplication
 * Phase 3.4 Batch 3: PII-safe, deduplicated topic catalog comparison logging
 */
function logShadowMismatch(
  routeId: string,
  legacyCount: number,
  bundleCount: number,
  missingInBundle: string[],
  extraInBundle: string[],
  orderDiff: boolean
): void {
  const key = makeShadowKey(
    routeId,
    missingInBundle,
    extraInBundle,
    orderDiff,
    legacyCount,
    bundleCount
  );

  // Dedup: only log once per signature
  if (EMITTED_SHADOW_KEYS.has(key)) {
    return;
  }
  EMITTED_SHADOW_KEYS.add(key);

  // Log with consistent prefix for filtering
  console.warn('[FLOW2][TOPIC_CATALOG][SHADOW]', {
    event: 'topic_catalog_shadow_mismatch',
    routeId,
    legacyCount,
    bundleCount,
    missingInBundle: missingInBundle.slice(0, 5), // Max 5 samples
    extraInBundle: extraInBundle.slice(0, 5), // Max 5 samples
    orderDiff,
  });
}

/**
 * Log active mode fallback with deduplication
 * Phase 3.4 Batch 4: PII-safe, deduplicated active mode fallback logging
 */
function logActiveFallback(
  routeId: string,
  reason: 'catalog_unavailable' | 'topic_sets_missing' | 'route_missing' | 'bundle_error' | 'bundle_unavailable'
): void {
  const key = `${routeId}|${reason}`;

  // Dedup: only log once per (routeId, reason) pair
  if (EMITTED_ACTIVE_FALLBACK_KEYS.has(key)) {
    return;
  }
  EMITTED_ACTIVE_FALLBACK_KEYS.add(key);

  // Log with consistent prefix for filtering
  console.warn('[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK]', {
    event: 'topic_catalog_active_fallback',
    routeId,
    reason,
  });
}

// ========================================
// LEGACY TOPIC SETS (Phase 3.4 baseline)
// ========================================

/**
 * Legacy KYC Review topic set (8 topics)
 * Source: app/lib/topicSummaries/configs.ts KYC_FLOW2_CONFIG
 */
const LEGACY_KYC_TOPICS: TopicSet = {
  topic_ids: [
    'customer_identity_profile',
    'relationship_purpose',
    'source_of_wealth',
    'source_of_funds',
    'ownership_ubo_control',
    'geography_jurisdiction_risk',
    'sanctions_pep_adverse_media',
    'transaction_patterns_expected_behavior',
  ],
  titles: {
    customer_identity_profile: 'Customer Identity & Profile',
    relationship_purpose: 'Relationship Purpose',
    source_of_wealth: 'Source of Wealth',
    source_of_funds: 'Source of Funds',
    ownership_ubo_control: 'Ownership, UBO & Control',
    geography_jurisdiction_risk: 'Geography & Jurisdiction Risk',
    sanctions_pep_adverse_media: 'Sanctions, PEP & Adverse Media',
    transaction_patterns_expected_behavior: 'Transaction Patterns & Expected Behavior',
  },
  source: 'legacy',
};

/**
 * Legacy Case2 CS Integration topic set (6 topics)
 * Source: app/lib/topicSummaries/configs.ts CASE2_CS_INTEGRATION_CONFIG
 */
const LEGACY_CASE2_TOPICS: TopicSet = {
  topic_ids: [
    'client_profile_legacy_context',
    'jurisdiction_crossborder_constraints',
    'risk_appetite_alignment',
    'edd_triggers_red_flags',
    'required_evidence_data_gaps',
    'recommended_approval_path_governance',
  ],
  titles: {
    client_profile_legacy_context: 'Client Profile & Legacy Context',
    jurisdiction_crossborder_constraints: 'Jurisdiction & Cross-border Constraints',
    risk_appetite_alignment: 'Risk Appetite Alignment',
    edd_triggers_red_flags: 'EDD Triggers & Red Flags',
    required_evidence_data_gaps: 'Required Evidence & Data Gaps',
    recommended_approval_path_governance: 'Recommended Approval Path & Governance',
  },
  source: 'legacy',
};

/**
 * Legacy IT Bulletin Impact topic set (5 topics)
 * Source: app/lib/topicSummaries/configs.ts IT_BULLETIN_CONFIG
 */
const LEGACY_IT_TOPICS: TopicSet = {
  topic_ids: [
    'system_components_identifiers',
    'regions_environments_scope',
    'change_details_what_changed',
    'timeline_execution_windows',
    'actions_required_followups',
  ],
  titles: {
    system_components_identifiers: 'System / Component Information',
    regions_environments_scope: 'Region / Environment Scope',
    change_details_what_changed: 'Change Details (What Changed)',
    timeline_execution_windows: 'Timeline / Execution Window',
    actions_required_followups: 'Required Actions / Follow-ups',
  },
  source: 'legacy',
};

/**
 * Fallback topic set for unknown routes
 */
const LEGACY_FALLBACK_TOPICS: TopicSet = {
  topic_ids: ['general_information'],
  titles: {
    general_information: 'General Information',
  },
  source: 'legacy',
};

/**
 * Get legacy topic set for a route (hardcoded baseline)
 */
function getLegacyTopicSet(routeId: Flow2RouteId): TopicSet {
  switch (routeId) {
    case 'kyc_review':
      return LEGACY_KYC_TOPICS;
    case 'case2_review':
      return LEGACY_CASE2_TOPICS;
    case 'it_review':
      return LEGACY_IT_TOPICS;
    case 'guardrail_check':
    case 'chat_general':
      return LEGACY_FALLBACK_TOPICS;
    default:
      console.warn(`[TopicSetResolver] Unknown route: ${routeId}, using fallback`);
      return LEGACY_FALLBACK_TOPICS;
  }
}

// ========================================
// BUNDLE TOPIC SETS (Phase 3.4 new)
// ========================================

/**
 * Get bundle topic set for a route (from YAML)
 * Returns null if bundle not available or route not found
 */
function getBundleTopicSet(routeId: Flow2RouteId, forceBundle: boolean): TopicSet | null {
  try {
    const catalog = getFlow2TopicCatalog(forceBundle);
    if (!catalog) {
      return null;
    }

    // Phase 3.4: Look for route-specific topic sets in catalog
    // Expected structure in topic_catalog.yaml:
    // topic_sets:
    //   kyc_review: [...]
    //   case2_review: [...]
    //   it_review: [...]
    const topicSets = (catalog as any).topic_sets;
    if (!topicSets || typeof topicSets !== 'object') {
      console.warn('[TopicSetResolver] No topic_sets in catalog');
      return null;
    }

    const topicIds = topicSets[routeId];
    if (!topicIds || !Array.isArray(topicIds)) {
      console.warn(`[TopicSetResolver] No topic set for route: ${routeId}`);
      return null;
    }

    // Extract titles from catalog if available
    const titles: Record<string, string> = {};
    if (catalog.topics && Array.isArray(catalog.topics)) {
      for (const topic of catalog.topics) {
        if (topic.topic_id && topic.title) {
          titles[topic.topic_id] = topic.title;
        }
      }
    }

    return {
      topic_ids: topicIds,
      titles: Object.keys(titles).length > 0 ? titles : undefined,
      source: 'bundle',
    };
  } catch (error: any) {
    console.error('[TopicSetResolver] Bundle load error:', error.message);
    return null;
  }
}

// ========================================
// PUBLIC API
// ========================================

/**
 * Resolve topic set for a given route
 *
 * Mode behavior:
 * - legacy: Always return legacy set (no bundle loading)
 * - shadow: Return legacy set (but allow forceBundle for comparison)
 * - active: Return bundle set if available, else fallback to legacy
 *
 * @param routeId - Route identifier (kyc_review, case2_review, it_review, etc.)
 * @param opts - Resolution options (forceBundle for shadow-run internal use only)
 * @returns TopicSet with topic_ids and optional titles
 */
export function resolveTopicSet(
  routeId: Flow2RouteId,
  opts?: ResolveOptions
): TopicSet {
  const mode = getFlow2BundleMode();
  const forceBundle = opts?.forceBundle || false;

  // Mode: legacy (default) - always return legacy
  if (mode === 'legacy' && !forceBundle) {
    return getLegacyTopicSet(routeId);
  }

  // Mode: shadow - return legacy (but allow forceBundle for comparison caller)
  if (mode === 'shadow') {
    if (forceBundle) {
      // Shadow-run caller requesting bundle for comparison
      const bundleSet = getBundleTopicSet(routeId, true);
      if (bundleSet) {
        return bundleSet;
      }
      // Fallback to legacy if bundle fails
      return getLegacyTopicSet(routeId);
    }

    // Phase 3.4 Batch 3: Shadow comparison (non-forceBundle path)
    // Compute legacy set
    const legacySet = getLegacyTopicSet(routeId);

    // Best-effort compute bundle set
    try {
      const bundleSet = getBundleTopicSet(routeId, true);

      if (bundleSet) {
        // Compare topic_ids arrays
        const { missingInBundle, extraInBundle, orderDiff } = diffArrays(
          legacySet.topic_ids,
          bundleSet.topic_ids
        );

        // Log only if mismatch exists
        if (missingInBundle.length > 0 || extraInBundle.length > 0 || orderDiff) {
          logShadowMismatch(
            routeId,
            legacySet.topic_ids.length,
            bundleSet.topic_ids.length,
            missingInBundle,
            extraInBundle,
            orderDiff
          );
        }
      }
      // If bundleSet is null, silently skip comparison (avoid noise)
    } catch (error: any) {
      // Best-effort: suppress errors, don't break shadow mode
      // No log to keep golden tests stable
    }

    // Always return legacy set in shadow mode
    return legacySet;
  }

  // Mode: active - return bundle if available, else fallback to legacy
  // Phase 3.4 Batch 4: Hardened with deduped fallback warnings
  if (mode === 'active') {
    try {
      const bundleSet = getBundleTopicSet(routeId, true);
      if (bundleSet) {
        // Bundle available and successfully loaded
        return bundleSet;
      }

      // Bundle unavailable (catalog missing, topic_sets missing, or route missing)
      // Fall back to legacy with deduped warning
      logActiveFallback(routeId, 'bundle_unavailable');
      return getLegacyTopicSet(routeId);
    } catch (error: any) {
      // Bundle loading threw an error - fall back to legacy
      logActiveFallback(routeId, 'bundle_error');
      return getLegacyTopicSet(routeId);
    }
  }

  // Unreachable (mode parser guarantees valid value)
  return getLegacyTopicSet(routeId);
}

/**
 * Get all available route IDs (for debugging/tooling)
 */
export function getAvailableRoutes(): Flow2RouteId[] {
  return ['kyc_review', 'case2_review', 'it_review', 'guardrail_check', 'chat_general'];
}
