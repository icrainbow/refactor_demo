/**
 * Flow2: Topic Assembler
 *
 * Extracts KYC topics from uploaded documents using deterministic rules.
 * No LLM calls in MVP (can add later for quality).
 *
 * Phase 3.1 Batch 4: Integrates high-risk keywords from policy bundle
 * Phase 3.2 A3: Added shadow-run wiring for keyword detection
 * Phase 3.3 A2: Added controlled cutover flag (bundleMode)
 */

import type { TopicSection, TopicId, EvidenceRef, ExtractedTopic } from './types';
import { getFlow2HighRiskKeywords } from '../skills/flow2/bundleAccessors';
import { getFlow2BundleMode, shouldCompareLegacyInActive } from '../skills/flow2/bundleMode';
import { StableFieldExtractors } from '../skills/shadowRun';
import {
  logMatch,
  logMismatch,
  logError,
  compareStableFields,
  type ShadowRunContext,
} from '../skills/shadowRunLogger';

const TOPIC_KEYWORDS: Record<TopicId, string[]> = {
  client_identity: ['name', 'identity', 'passport', 'id number', 'date of birth', 'nationality'],
  source_of_wealth: ['wealth', 'income', 'salary', 'inheritance', 'business', 'employment'],
  business_relationship: ['relationship', 'purpose', 'account', 'services', 'products'],
  beneficial_ownership: ['beneficial owner', 'ownership', 'shareholder', 'director', 'ubo'],
  risk_profile: ['risk', 'appetite', 'tolerance', 'aml', 'rating'],
  sanctions_pep: ['sanctions', 'pep', 'politically exposed', 'watchlist', 'screening'],
  transaction_patterns: ['transaction', 'volume', 'frequency', 'pattern', 'activity'],
  other: []
};

const TOPIC_TITLES: Record<TopicId, string> = {
  client_identity: 'Client Identity & Verification',
  source_of_wealth: 'Source of Wealth & Income',
  business_relationship: 'Business Relationship Purpose',
  beneficial_ownership: 'Beneficial Ownership Structure',
  risk_profile: 'Risk Profile & Appetite',
  sanctions_pep: 'Sanctions & PEP Screening',
  transaction_patterns: 'Expected Transaction Patterns',
  other: 'Other Information'
};

const TOPIC_IDS: TopicId[] = [
  'client_identity',
  'source_of_wealth',
  'business_relationship',
  'beneficial_ownership',
  'risk_profile',
  'sanctions_pep',
  'transaction_patterns'
];

/**
 * Assemble topics from raw document text
 *
 * Algorithm:
 * 1. Split documents into paragraphs
 * 2. For each paragraph, match against topic keywords
 * 3. Assign to best-matching topic
 * 4. Assess coverage based on content length and keyword density
 */
export function assembleTopics(documents: { name: string; content: string }[]): TopicSection[] {
  const topicSections: Record<string, TopicSection> = {};

  // Initialize all topics
  TOPIC_IDS.forEach(topicId => {
    topicSections[topicId] = {
      topicId,
      content: '',
      evidenceRefs: [],
      coverage: 'missing'
    };
  });

  // Process each document
  documents.forEach(doc => {
    const paragraphs = doc.content.split('\n\n').filter(p => p.trim().length > 20);

    paragraphs.forEach((para, idx) => {
      const paraLower = para.toLowerCase();

      // Find best matching topic
      let bestTopic: TopicId | null = null;
      let bestScore = 0;

      TOPIC_IDS.forEach(topicId => {
        const keywords = TOPIC_KEYWORDS[topicId];
        const matches = keywords.filter(kw => paraLower.includes(kw.toLowerCase())).length;
        if (matches > bestScore) {
          bestScore = matches;
          bestTopic = topicId;
        }
      });

      // Add to topic section if match found
      if (bestScore > 0 && bestTopic) {
        const section = topicSections[bestTopic];
        section.content += (section.content ? '\n\n' : '') + para;
        section.evidenceRefs.push({
          docName: doc.name,
          pageOrSection: `Para ${idx + 1}`,
          snippet: para.substring(0, 100) + (para.length > 100 ? '...' : '')
        });
      }
    });
  });

  // Assess coverage
  TOPIC_IDS.forEach(topicId => {
    const section = topicSections[topicId];
    const contentLength = section.content.length;

    if (contentLength === 0) {
      section.coverage = 'missing';
    } else if (contentLength < 200) {
      section.coverage = 'partial';
    } else {
      section.coverage = 'complete';
    }
  });

  return Object.values(topicSections);
}

/**
 * Extract high-risk keywords for policy flags
 *
 * Phase 3.1 Batch 4: Uses bundle keywords if enabled, else legacy array
 * Phase 3.2 A3: Added shadow-run wiring - always returns legacy, logs bundle comparison
 * Phase 3.3 A2: Controlled cutover via FLOW2_BUNDLE_MODE
 *
 * Modes:
 * - legacy: Compute and return legacy only (DEFAULT)
 * - shadow: Compute both, compare stable fields, return legacy
 * - active: Compute and return bundle (fallback to legacy on error)
 */
export function extractHighRiskKeywords(content: string): string[] {
  const mode = getFlow2BundleMode();

  // Mode: legacy (default) - compute and return legacy only
  if (mode === 'legacy') {
    return _extractHighRiskKeywordsCore(content, false);
  }

  // Mode: shadow - compute both, compare, return legacy
  if (mode === 'shadow') {
    const legacyResult = _extractHighRiskKeywordsCore(content, false);

    const context: ShadowRunContext = {
      component: 'highRiskKeywords',
      timestamp: new Date().toISOString(),
    };

    try {
      // Compute bundle result (forceEnable=true)
      const bundleResult = _extractHighRiskKeywordsCore(content, true);

      // Extract stable fields only
      const legacyStable = StableFieldExtractors.highRiskStable(legacyResult);
      const bundleStable = StableFieldExtractors.highRiskStable(bundleResult);

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
      component: 'highRiskKeywords',
      timestamp: new Date().toISOString(),
    };

    try {
      // Compute bundle result (forceEnable=true)
      const bundleResult = _extractHighRiskKeywordsCore(content, true);

      // Phase 3.3.1: Optional legacy comparison (only if FLOW2_BUNDLE_COMPARE=true)
      if (shouldCompareLegacyInActive()) {
        try {
          const legacyResult = _extractHighRiskKeywordsCore(content, false);
          const legacyStable = StableFieldExtractors.highRiskStable(legacyResult);
          const bundleStable = StableFieldExtractors.highRiskStable(bundleResult);

          const diffs = compareStableFields(legacyStable, bundleStable);
          if (diffs.length > 0) {
            logMismatch(context, diffs);
          }
        } catch (legacyError: any) {
          // Legacy comparison failed, but continue with bundle result
          console.warn('[highRiskKeywords:active] Legacy comparison failed:', legacyError.message);
        }
      }

      // Return bundle result in active mode
      return bundleResult;
    } catch (error: any) {
      // Bundle computation failed - fallback to legacy (prod-safe)
      logError(context, 'bundle', error);
      console.error('[highRiskKeywords:active] Bundle failed, falling back to legacy');

      return _extractHighRiskKeywordsCore(content, false);
    }
  }

  // Unreachable (mode parser guarantees valid value), but TypeScript safety
  return _extractHighRiskKeywordsCore(content, false);
}

/**
 * Core keyword extraction logic (internal)
 * Phase 3.2: Extracted to support shadow-run with forceEnable parameter
 *
 * @param content - Document content to scan
 * @param forceEnable - Force bundle loading for shadow-run (INTERNAL USE ONLY)
 */
function _extractHighRiskKeywordsCore(content: string, forceEnable: boolean): string[] {
  // Legacy high-risk keywords
  const LEGACY_HIGH_RISK_KEYWORDS = [
    'sanctions',
    'pep',
    'politically exposed',
    'high risk',
    'shell company',
    'offshore',
    'cash intensive',
    'cryptocurrency',
    'gambling',
    'arms',
    'tobacco'
  ];

  // Get keywords from bundle or use legacy
  const keywords = getFlow2HighRiskKeywords(forceEnable) || LEGACY_HIGH_RISK_KEYWORDS;

  const contentLower = content.toLowerCase();
  return keywords.filter(kw => contentLower.includes(kw.toLowerCase()));
}

/**
 * Convert TopicSections to ExtractedTopics for UI display
 *
 * This creates user-friendly topic summaries from document content (NOT risk findings).
 * Used by Key Topics Extracted panel to show what documents contain.
 */
export function convertToExtractedTopics(topicSections: TopicSection[]): ExtractedTopic[] {
  const extracted: ExtractedTopic[] = [];

  topicSections.forEach(section => {
    // Skip empty topics
    if (section.coverage === 'missing' || !section.content.trim()) {
      return;
    }

    // Generate summary from content (first 200 chars)
    const summary = section.content
      .substring(0, 200)
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      + (section.content.length > 200 ? '...' : '');

    // Extract evidence references
    const evidence = section.evidenceRefs
      .slice(0, 3) // Max 3 refs
      .map(ref => `${ref.docName} (${ref.pageOrSection || 'N/A'})`);

    extracted.push({
      title: TOPIC_TITLES[section.topicId] || section.topicId,
      summary,
      evidence,
      coverage: section.coverage
    });
  });

  return extracted;
}
