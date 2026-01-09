/**
 * Flow2: Topic Assembler
 *
 * Extracts KYC topics from uploaded documents using deterministic rules.
 * No LLM calls in MVP (can add later for quality).
 *
 * Phase 4: Simplified to use only core assembly logic
 */

import type { TopicSection, TopicId, EvidenceRef, ExtractedTopic } from './types';

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
 * Phase 4: Simplified to use only legacy keywords
 */
export function extractHighRiskKeywords(content: string): string[] {
  return _extractHighRiskKeywordsCore(content);
}

/**
 * Core keyword extraction logic (internal)
 * Phase 4: Simplified to use only legacy keywords
 *
 * @param content - Document content to scan
 */
function _extractHighRiskKeywordsCore(content: string): string[] {
  // High-risk keywords
  const keywords = [
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
