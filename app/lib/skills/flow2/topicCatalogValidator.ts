/**
 * Phase 3.4 Batch 5: Topic Catalog Validator
 *
 * Pure deterministic validation for topic_catalog.yaml structure.
 * Never throws; always returns validation result.
 *
 * Validates:
 * - topic_sets structure (required)
 * - topic_sets entries are arrays of strings
 * - no duplicate topic_ids within a topic_set
 * - referential integrity (if catalog.topics exists)
 * - route naming conventions (warnings only)
 */

export interface TopicCatalogValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats?: {
    topicCount: number;
    topicSetCount: number;
  };
}

/**
 * Known route patterns for typo detection
 * Used for warnings only, not strict validation
 */
const KNOWN_ROUTE_PATTERNS = [
  'kyc_review',
  'case2_review',
  'it_review',
  'guardrail_check',
  'chat_general',
];

/**
 * Validate Flow2 topic catalog structure
 *
 * @param catalog - Parsed YAML catalog (unknown type for safety)
 * @returns Validation result with errors and warnings
 */
export function validateFlow2TopicCatalog(catalog: unknown): TopicCatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ========================================
  // RULE 1: catalog must be an object (not array or null)
  // ========================================
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return {
      ok: false,
      errors: ['Catalog must be an object'],
      warnings: [],
    };
  }

  const cat = catalog as Record<string, any>;

  // ========================================
  // RULE 2: topic_sets must exist and be object (not array or null)
  // ========================================
  if (!('topic_sets' in cat)) {
    errors.push('Missing required field: topic_sets');
  } else if (typeof cat.topic_sets !== 'object' || cat.topic_sets === null || Array.isArray(cat.topic_sets)) {
    errors.push('topic_sets must be an object');
  }

  // Early exit if topic_sets validation failed
  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors.sort(),
      warnings: warnings.sort(),
    };
  }

  const topicSets = cat.topic_sets as Record<string, any>;
  const topicSetKeys = Object.keys(topicSets);

  // Build available topic_ids set (from catalog.topics if it exists)
  const availableTopicIds = new Set<string>();
  if (cat.topics && Array.isArray(cat.topics)) {
    for (const topic of cat.topics) {
      if (topic && typeof topic === 'object' && typeof topic.topic_id === 'string') {
        availableTopicIds.add(topic.topic_id);
      }
    }
  }

  // ========================================
  // RULE 3: Each topic_set entry must be array of strings
  // RULE 4: No duplicates within a topic_set
  // RULE 5: Referential integrity (if catalog.topics exists)
  // RULE 6: Route naming conventions (warnings)
  // ========================================
  for (const routeId of topicSetKeys) {
    const topicSet = topicSets[routeId];

    // Check if it's an array
    if (!Array.isArray(topicSet)) {
      errors.push(`topic_sets.${routeId}: must be an array`);
      continue;
    }

    // Check all elements are strings
    const nonStrings = topicSet.filter(item => typeof item !== 'string');
    if (nonStrings.length > 0) {
      errors.push(`topic_sets.${routeId}: contains non-string elements`);
      continue;
    }

    const topicIds = topicSet as string[];

    // Check for duplicates
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const topicId of topicIds) {
      if (seen.has(topicId)) {
        duplicates.push(topicId);
      }
      seen.add(topicId);
    }

    if (duplicates.length > 0) {
      errors.push(`topic_sets.${routeId}: contains duplicate topic_ids [${duplicates.join(', ')}]`);
    }

    // Check referential integrity (only if catalog.topics exists)
    if (availableTopicIds.size > 0) {
      const missing = topicIds.filter(id => !availableTopicIds.has(id));
      if (missing.length > 0) {
        // Note: This is a soft warning for now since case2_review and it_review
        // use topic IDs not in the main catalog.topics array
        warnings.push(`topic_sets.${routeId}: references topic_ids not in catalog.topics [${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}]`);
      }
    }

    // Check route naming conventions (warnings for typos)
    if (!KNOWN_ROUTE_PATTERNS.includes(routeId)) {
      // Check for common typos
      if (routeId.includes(' ') || routeId.includes('-')) {
        warnings.push(`topic_sets.${routeId}: route name contains spaces or hyphens (expected underscore)`);
      }

      // Check for close matches to known patterns (Levenshtein distance would be overkill)
      const lowerRoute = routeId.toLowerCase();
      const closeMatches = KNOWN_ROUTE_PATTERNS.filter(known =>
        lowerRoute.includes(known.replace(/_/g, '')) || known.replace(/_/g, '').includes(lowerRoute)
      );

      if (closeMatches.length > 0) {
        warnings.push(`topic_sets.${routeId}: unknown route (did you mean: ${closeMatches.join(', ')}?)`);
      }
    }
  }

  // ========================================
  // Build stats
  // ========================================
  const stats = {
    topicCount: availableTopicIds.size,
    topicSetCount: topicSetKeys.length,
  };

  // ========================================
  // Return result
  // ========================================
  const ok = errors.length === 0;

  return {
    ok,
    errors: errors.sort(),
    warnings: warnings.sort(),
    stats,
  };
}

/**
 * Format validation result for logging
 * Returns a human-readable string summary
 */
export function formatValidationResult(result: TopicCatalogValidationResult): string {
  const lines: string[] = [];

  if (result.ok) {
    lines.push('✓ Topic catalog validation passed');
    if (result.stats) {
      lines.push(`  Topics: ${result.stats.topicCount}, Topic Sets: ${result.stats.topicSetCount}`);
    }
  } else {
    lines.push('✗ Topic catalog validation failed');
  }

  if (result.errors.length > 0) {
    lines.push(`  Errors (${result.errors.length}):`);
    result.errors.forEach(err => lines.push(`    - ${err}`));
  }

  if (result.warnings.length > 0) {
    lines.push(`  Warnings (${result.warnings.length}):`);
    result.warnings.forEach(warn => lines.push(`    - ${warn}`));
  }

  return lines.join('\n');
}
