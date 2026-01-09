/**
 * Flow2: Risk Triage
 *
 * Computes risk score and decides graph execution path.
 * Deterministic rules based on coverage, conflicts, and keywords.
 *
 * Phase 4: Simplified to use only core triage logic, removed bundle mode switching
 */

import type { TopicSection, GraphPath, RiskBreakdown } from './types';
import { extractHighRiskKeywords } from './topicAssembler';

export interface TriageResult {
  riskScore: number; // 0-100
  triageReasons: string[];
  routePath: GraphPath;
  riskBreakdown: RiskBreakdown; // NEW: Breakdown for transparency
}

/**
 * Compute risk score and triage path
 *
 * Phase 4: Simplified to use only core triage logic
 *
 * Risk scoring:
 * - Missing coverage: +15 per missing critical topic
 * - Partial coverage: +8 per partial topic
 * - High-risk keywords: +10 per keyword
 * - Conflicts (if detected): +20 per conflict
 *
 * Path routing:
 * - 0-30: fast (low risk)
 * - 31-60: crosscheck (medium risk)
 * - 61-80: escalate (high risk)
 * - 81-100: human_gate (critical risk)
 */
export function triageRisk(topicSections: TopicSection[]): TriageResult {
  return _triageRiskCore(topicSections);
}

/**
 * Core triage logic (internal)
 * Phase 4: Simplified to use only legacy constants
 *
 * @param topicSections - Topic sections from document analysis
 */
function _triageRiskCore(topicSections: TopicSection[]): TriageResult {
  let coverageRiskScore = 0;
  let keywordRiskScore = 0;
  const triageReasons: string[] = [];

  // Critical Topics
  const criticalTopicIds = ['client_identity', 'source_of_wealth', 'beneficial_ownership', 'sanctions_pep'];

  // Scoring Rules
  const scoringRules = {
    missing_critical_topic: 15,
    missing_non_critical_topic: 8,
    high_risk_keyword_multiplier: 10,
  };

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

  // Routing Thresholds
  const thresholds = {
    fast: [0, 30] as [number, number],
    crosscheck: [31, 60] as [number, number],
    escalate: [61, 80] as [number, number],
    human_gate: [81, 100] as [number, number],
  };

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

