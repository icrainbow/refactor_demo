/**
 * Phase 3: Shadow-Run Infrastructure
 *
 * Executes both legacy and bundle code paths in parallel.
 * Compares ONLY stable, deterministic fields.
 * Logs discrepancies without failing requests.
 *
 * Enabled via: FLOW2_SHADOW_RUN=true (dev only)
 */

// ========================================
// TYPES
// ========================================

export interface ShadowRunResult<T> {
  primary: T;
  shadow: T;
  comparison: {
    matched: boolean;
    stableFieldsDiff: Record<string, any>;
    warnings: string[];
  };
}

export type StableFieldExtractor<T> = (result: T) => Record<string, any>;

// ========================================
// SHADOW-RUN EXECUTION
// ========================================

/**
 * Execute shadow-run: Primary (legacy) + Shadow (bundle) in parallel
 * Compare ONLY stable fields defined by extractor
 *
 * Rules:
 * - Always return primary result (legacy is source of truth)
 * - Log mismatches but never fail the request
 * - Only run if FLOW2_SHADOW_RUN=true
 */
export async function shadowRun<T>(
  primaryFn: () => Promise<T> | T,
  shadowFn: () => Promise<T> | T,
  extractor: StableFieldExtractor<T>,
  label: string
): Promise<T> {
  // Check if shadow-run enabled
  if (process.env.FLOW2_SHADOW_RUN !== 'true') {
    // Shadow-run disabled - just execute primary
    return await Promise.resolve(primaryFn());
  }

  console.log(`[ShadowRun/${label}] Starting parallel execution...`);

  const startTime = Date.now();

  // Execute both paths in parallel (non-blocking)
  const [primaryResult, shadowResult] = await Promise.allSettled([
    Promise.resolve(primaryFn()),
    Promise.resolve(shadowFn())
  ]);

  const duration = Date.now() - startTime;

  // Handle execution failures
  if (primaryResult.status === 'rejected') {
    console.error(`[ShadowRun/${label}] PRIMARY FAILED:`, primaryResult.reason);
    throw new Error(`Primary execution failed: ${primaryResult.reason}`);
  }

  if (shadowResult.status === 'rejected') {
    console.warn(`[ShadowRun/${label}] Shadow execution failed (non-blocking):`, shadowResult.reason);
    // Return primary result (shadow failure is non-blocking)
    return primaryResult.value;
  }

  // Extract stable fields
  const primaryStable = extractor(primaryResult.value);
  const shadowStable = extractor(shadowResult.value);

  // Deep compare stable fields
  const comparison = compareStableFields(primaryStable, shadowStable, label);

  // Log results
  if (comparison.matched) {
    console.log(`[ShadowRun/${label}] ✅ MATCHED (${duration}ms)`);
  } else {
    console.warn(`[ShadowRun/${label}] ⚠️  MISMATCH (${duration}ms)`);
    console.warn(`[ShadowRun/${label}] Diff:`, JSON.stringify(comparison.stableFieldsDiff, null, 2));
    console.warn(`[ShadowRun/${label}] Warnings:`, comparison.warnings);
  }

  // Always return primary result (legacy is source of truth)
  return primaryResult.value;
}

// ========================================
// STABLE FIELD COMPARISON
// ========================================

/**
 * Compare stable fields only
 * Returns detailed diff and warnings
 */
function compareStableFields(
  primary: Record<string, any>,
  shadow: Record<string, any>,
  label: string
): {
  matched: boolean;
  stableFieldsDiff: Record<string, any>;
  warnings: string[];
} {
  const diff: Record<string, any> = {};
  const warnings: string[] = [];

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(primary), ...Object.keys(shadow)]);

  for (const key of Array.from(allKeys)) {
    const primaryValue = primary[key];
    const shadowValue = shadow[key];

    // Deep equality check
    if (!deepEqual(primaryValue, shadowValue)) {
      diff[key] = {
        primary: primaryValue,
        shadow: shadowValue
      };
      warnings.push(`Field '${key}' mismatch`);
    }
  }

  return {
    matched: Object.keys(diff).length === 0,
    stableFieldsDiff: diff,
    warnings
  };
}

/**
 * Deep equality check for stable field comparison
 * Handles primitives, arrays, sets, and objects
 */
function deepEqual(a: any, b: any): boolean {
  // Strict equality for primitives
  if (a === b) return true;

  // Null/undefined checks
  if (a == null || b == null) return a === b;

  // Type mismatch
  if (typeof a !== typeof b) return false;

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    // Sort both arrays for order-independent comparison
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((val, idx) => deepEqual(val, sortedB[idx]));
  }

  // Set comparison (order-independent)
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;

    const arrA = Array.from(a as Set<any>).sort();
    const arrB = Array.from(b as Set<any>).sort();

    return arrA.every((val, idx) => deepEqual(val, arrB[idx]));
  }

  // Object comparison
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  // Default: not equal
  return false;
}

// ========================================
// STABLE FIELD EXTRACTORS
// ========================================

/**
 * Pre-defined extractors for common domain objects
 * Extract ONLY stable, deterministic fields
 */
export const StableFieldExtractors = {
  /**
   * Triage Result Extractor
   * STABLE: routePath, critical_hits (set)
   * EXCLUDED: riskScore (numeric may vary slightly)
   */
  triageResult: (result: any) => ({
    routePath: result.routePath || result.route_path,
    critical_hits: Array.from(new Set(
      (result.critical_topics_missing || []).map((t: any) => t.topic_id || t)
    )).sort()
  }),

  /**
   * Topic Sections Extractor
   * STABLE: topic_ids (set), coverage flags (set)
   * EXCLUDED: content text, evidence snippets
   */
  topicSections: (sections: any[]) => ({
    topic_ids: Array.from(new Set(
      sections.map(s => s.topicId || s.topic_id)
    )).sort(),
    coverage_flags: Array.from(new Set(
      sections.map(s => `${s.topicId || s.topic_id}:${s.coverage}`)
    )).sort()
  }),

  /**
   * Guardrail Result Extractor
   * STABLE: guardrail_triggered (boolean), reason_code
   * EXCLUDED: reason text, details
   */
  guardrailResult: (result: any) => ({
    guardrail_triggered: result.triggered || result.guardrail_triggered || false,
    reason_code: result.reason_code || result.code || null
  }),

  /**
   * Route Match Extractor
   * STABLE: route_id, hitl boolean
   * EXCLUDED: route descriptions, trigger text
   */
  routeMatch: (result: any) => ({
    route_id: result.route_id || result.routeId,
    hitl: result.hitl || result.human_review_required || false
  }),

  /**
   * Template Result Extractor
   * STABLE: template_id, has required placeholders
   * EXCLUDED: actual HTML content
   */
  templateResult: (result: any) => ({
    template_id: result.template_id || result.templateId,
    has_approve_button: (result.html || '').includes('Approve') || (result.html || '').includes('{{approve_url}}'),
    has_reject_button: (result.html || '').includes('Reject') || (result.html || '').includes('{{reject_url}}')
  }),

  /**
   * Phase 3.2: Triage Stable Fields Extractor
   * STABLE: routePath, riskScore (deterministic), breakdown points, critical missing count
   * EXCLUDED: triageReasons text (contains document-specific details)
   */
  triageStable: (result: any) => ({
    routePath: result.routePath || result.route_path,
    riskScore: result.riskScore || 0,
    coveragePoints: result.riskBreakdown?.coveragePoints || 0,
    keywordPoints: result.riskBreakdown?.keywordPoints || 0,
    totalPoints: result.riskBreakdown?.totalPoints || result.riskScore || 0,
  }),

  /**
   * Phase 3.2: High-Risk Keywords Stable Fields Extractor
   * STABLE: hitCount, matchedKeywords (sorted, de-duplicated)
   * EXCLUDED: content text, keyword positions
   */
  highRiskStable: (keywords: string[]) => ({
    hitCount: keywords.length,
    matchedKeywords: Array.from(new Set(keywords)).sort(),
  })
};
