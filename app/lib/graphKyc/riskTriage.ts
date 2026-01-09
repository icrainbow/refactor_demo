/**
 * Flow2: Risk Triage
 *
 * Computes risk score and decides graph execution path.
 * Deterministic rules based on coverage, conflicts, and keywords.
 *
 * Phase 3.1 Batch 3-5: Integrates bundle triage rules with legacy fallback
 * Phase 3.2 A3: Added shadow-run wiring for validation
 * Phase 3.3 A2: Added controlled cutover flag (bundleMode)
 */

import type { TopicSection, GraphPath, RiskBreakdown } from './types';
import { extractHighRiskKeywords } from './topicAssembler';
import {
  getFlow2CriticalTopicIds,
  getFlow2TriageScoringRules,
  getFlow2RoutingThresholds,
} from '../skills/flow2/bundleAccessors';
import { getFlow2BundleMode, shouldCompareLegacyInActive } from '../skills/flow2/bundleMode';
import { StableFieldExtractors } from '../skills/shadowRun';
import {
  logMatch,
  logMismatch,
  logError,
  compareStableFields,
  type ShadowRunContext,
} from '../skills/shadowRunLogger';

export interface TriageResult {
  riskScore: number; // 0-100
  triageReasons: string[];
  routePath: GraphPath;
  riskBreakdown: RiskBreakdown; // NEW: Breakdown for transparency
}

/**
 * Compute risk score and triage path
 *
 * Phase 3.1 Batch 3-5: Uses bundle rules if enabled, else legacy constants
 * Phase 3.2 A3: Added shadow-run wiring - always returns legacy, logs bundle comparison
 * Phase 3.3 A2: Controlled cutover via FLOW2_BUNDLE_MODE
 *
 * Modes:
 * - legacy: Compute and return legacy only (DEFAULT)
 * - shadow: Compute both, compare stable fields, return legacy
 * - active: Compute and return bundle (fallback to legacy on error)
 *
 * Risk scoring:
 * - Missing coverage: +15 per missing critical topic (configurable via bundle)
 * - Partial coverage: +8 per partial topic (configurable via bundle)
 * - High-risk keywords: +10 per keyword (configurable via bundle)
 * - Conflicts (if detected): +20 per conflict
 *
 * Path routing:
 * - 0-30: fast (low risk) - configurable via bundle
 * - 31-60: crosscheck (medium risk) - configurable via bundle
 * - 61-80: escalate (high risk) - configurable via bundle
 * - 81-100: human_gate (critical risk) - configurable via bundle
 */
export function triageRisk(topicSections: TopicSection[]): TriageResult {
  const mode = getFlow2BundleMode();

  // Mode: legacy (default) - compute and return legacy only
  if (mode === 'legacy') {
    return _triageRiskCore(topicSections, false);
  }

  // Mode: shadow - compute both, compare, return legacy
  if (mode === 'shadow') {
    const legacyResult = _triageRiskCore(topicSections, false);

    const context: ShadowRunContext = {
      component: 'riskTriage',
      timestamp: new Date().toISOString(),
    };

    try {
      // Compute bundle result (forceEnable=true)
      const bundleResult = _triageRiskCore(topicSections, true);

      // Extract stable fields only
      const legacyStable = StableFieldExtractors.triageStable(legacyResult);
      const bundleStable = StableFieldExtractors.triageStable(bundleResult);

      // Compare and log
      const diffs = compareStableFields(legacyStable, bundleStable);
      if (diffs.length === 0) {
        logMatch(context, legacyStable, bundleStable);
      } else {
        logMismatch(context, diffs);
      }
    } catch (error: any) {
      logError(context, 'bundle', error);
    }

    // Always return legacy in shadow mode
    return legacyResult;
  }

  // Mode: active - compute and return bundle (fallback to legacy on error)
  if (mode === 'active') {
    const context: ShadowRunContext = {
      component: 'riskTriage',
      timestamp: new Date().toISOString(),
    };

    try {
      // Compute bundle result (forceEnable=true)
      const bundleResult = _triageRiskCore(topicSections, true);

      // Phase 3.3.1: Optional legacy comparison (only if FLOW2_BUNDLE_COMPARE=true)
      if (shouldCompareLegacyInActive()) {
        try {
          const legacyResult = _triageRiskCore(topicSections, false);
          const legacyStable = StableFieldExtractors.triageStable(legacyResult);
          const bundleStable = StableFieldExtractors.triageStable(bundleResult);

          const diffs = compareStableFields(legacyStable, bundleStable);
          if (diffs.length > 0) {
            logMismatch(context, diffs);
          }
        } catch (legacyError: any) {
          // Legacy comparison failed, but continue with bundle result
          console.warn('[riskTriage:active] Legacy comparison failed:', legacyError.message);
        }
      }

      // Return bundle result in active mode
      return bundleResult;
    } catch (error: any) {
      // Bundle computation failed - fallback to legacy (prod-safe)
      logError(context, 'bundle', error);
      console.error('[riskTriage:active] Bundle failed, falling back to legacy');

      return _triageRiskCore(topicSections, false);
    }
  }

  // Unreachable (mode parser guarantees valid value), but TypeScript safety
  return _triageRiskCore(topicSections, false);
}

/**
 * Core triage logic (internal)
 * Phase 3.2: Extracted to support shadow-run with forceEnable parameter
 *
 * @param topicSections - Topic sections from document analysis
 * @param forceEnable - Force bundle loading for shadow-run (INTERNAL USE ONLY)
 */
function _triageRiskCore(topicSections: TopicSection[], forceEnable: boolean): TriageResult {
  let coverageRiskScore = 0;
  let keywordRiskScore = 0;
  const triageReasons: string[] = [];

  // ========================================
  // BATCH 3: Critical Topics (bundle or legacy)
  // ========================================
  const LEGACY_CRITICAL_TOPICS = ['client_identity', 'source_of_wealth', 'beneficial_ownership', 'sanctions_pep'];
  const criticalTopicIds = getFlow2CriticalTopicIds(forceEnable) || LEGACY_CRITICAL_TOPICS;

  // ========================================
  // BATCH 5: Scoring Rules (bundle or legacy)
  // ========================================
  const LEGACY_SCORING = {
    missing_critical_topic: 15,
    missing_non_critical_topic: 8,
    high_risk_keyword_multiplier: 10,
  };
  const scoringRules = getFlow2TriageScoringRules(forceEnable) || LEGACY_SCORING;

  // ========================================
  // COVERAGE CHECKS
  // ========================================
  topicSections.forEach(section => {
    if (section.coverage === 'missing' && criticalTopicIds.includes(section.topicId)) {
      coverageRiskScore += scoringRules.missing_critical_topic;
      triageReasons.push(`Missing critical topic: ${section.topicId}`);
    } else if (section.coverage === 'partial') {
      coverageRiskScore += scoringRules.missing_non_critical_topic;
      triageReasons.push(`Partial coverage: ${section.topicId}`);
    }
  });

  // ========================================
  // HIGH-RISK KEYWORDS
  // ========================================
  const allContent = topicSections.map(s => s.content).join(' ');
  const highRiskKeywords = extractHighRiskKeywords(allContent);

  if (highRiskKeywords.length > 0) {
    keywordRiskScore = highRiskKeywords.length * scoringRules.high_risk_keyword_multiplier;
    triageReasons.push(`High-risk keywords detected: ${highRiskKeywords.join(', ')}`);
  }

  // Total risk score
  let riskScore = coverageRiskScore + keywordRiskScore;

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  // Build breakdown
  const riskBreakdown: RiskBreakdown = {
    coveragePoints: coverageRiskScore,
    keywordPoints: keywordRiskScore,
    totalPoints: riskScore
  };

  // ========================================
  // BATCH 5: Routing Thresholds (bundle or legacy)
  // ========================================
  const LEGACY_THRESHOLDS = {
    fast: [0, 30] as [number, number],
    crosscheck: [31, 60] as [number, number],
    escalate: [61, 80] as [number, number],
    human_gate: [81, 100] as [number, number],
  };
  const thresholds = getFlow2RoutingThresholds(forceEnable) || LEGACY_THRESHOLDS;

  // Decide path based on thresholds
  let routePath: GraphPath;
  if (riskScore >= thresholds.fast[0] && riskScore <= thresholds.fast[1]) {
    routePath = 'fast';
    triageReasons.push('Low risk → Fast path');
  } else if (riskScore >= thresholds.crosscheck[0] && riskScore <= thresholds.crosscheck[1]) {
    routePath = 'crosscheck';
    triageReasons.push('Medium risk → Cross-check path');
  } else if (riskScore >= thresholds.escalate[0] && riskScore <= thresholds.escalate[1]) {
    routePath = 'escalate';
    triageReasons.push('High risk → Escalate path');
  } else {
    routePath = 'human_gate';
    triageReasons.push('Critical risk → Human gate required');
  }

  return {
    riskScore,
    triageReasons,
    routePath,
    riskBreakdown
  };
}

