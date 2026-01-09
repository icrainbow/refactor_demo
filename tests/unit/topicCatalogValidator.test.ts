import { describe, it, expect } from 'vitest';
import {
  validateFlow2TopicCatalog,
  formatValidationResult,
  type TopicCatalogValidationResult,
} from '../../app/lib/skills/flow2/topicCatalogValidator';

/**
 * Phase 3.4 Batch 5: Topic Catalog Validator Unit Tests
 *
 * Comprehensive tests for topic_catalog.yaml structure validation
 */

describe('validateFlow2TopicCatalog', () => {
  describe('Valid catalogs', () => {
    it('should validate a minimal valid catalog', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats?.topicSetCount).toBe(1);
    });

    it('should validate catalog with multiple topic sets', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', 'relationship_purpose'],
          case2_review: ['client_profile_legacy_context', 'jurisdiction_crossborder_constraints'],
          it_review: ['system_components_identifiers'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats?.topicSetCount).toBe(3);
    });

    it('should validate catalog with topics array (full structure)', () => {
      const catalog = {
        topics: [
          { topic_id: 'customer_identity_profile', title: 'Customer Identity & Profile' },
          { topic_id: 'relationship_purpose', title: 'Relationship Purpose' },
        ],
        topic_sets: {
          kyc_review: ['customer_identity_profile', 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.stats?.topicCount).toBe(2);
      expect(result.stats?.topicSetCount).toBe(1);
    });
  });

  describe('Invalid catalog types', () => {
    it('should reject null catalog', () => {
      const result = validateFlow2TopicCatalog(null);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Catalog must be an object']);
    });

    it('should reject undefined catalog', () => {
      const result = validateFlow2TopicCatalog(undefined);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Catalog must be an object']);
    });

    it('should reject string catalog', () => {
      const result = validateFlow2TopicCatalog('not an object');

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Catalog must be an object']);
    });

    it('should reject array catalog', () => {
      const result = validateFlow2TopicCatalog([{ topic_sets: {} }]);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Catalog must be an object']);
    });
  });

  describe('Missing or invalid topic_sets', () => {
    it('should reject catalog without topic_sets', () => {
      const catalog = {
        topics: [],
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Missing required field: topic_sets');
    });

    it('should reject catalog with null topic_sets', () => {
      const catalog = {
        topic_sets: null,
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets must be an object');
    });

    it('should reject catalog with array topic_sets', () => {
      const catalog = {
        topic_sets: ['kyc_review'],
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets must be an object');
    });
  });

  describe('Invalid topic_set entries', () => {
    it('should reject non-array topic_set', () => {
      const catalog = {
        topic_sets: {
          kyc_review: 'customer_identity_profile',
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets.kyc_review: must be an array');
    });

    it('should reject topic_set with non-string elements', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', 123, 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets.kyc_review: contains non-string elements');
    });

    it('should reject topic_set with null elements', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', null, 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets.kyc_review: contains non-string elements');
    });

    it('should reject topic_set with object elements', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', { id: 'test' }, 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('topic_sets.kyc_review: contains non-string elements');
    });
  });

  describe('Duplicate detection', () => {
    it('should reject topic_set with duplicate topic_ids', () => {
      const catalog = {
        topic_sets: {
          kyc_review: [
            'customer_identity_profile',
            'relationship_purpose',
            'customer_identity_profile', // duplicate
          ],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        'topic_sets.kyc_review: contains duplicate topic_ids [customer_identity_profile]'
      );
    });

    it('should reject topic_set with multiple duplicates', () => {
      const catalog = {
        topic_sets: {
          kyc_review: [
            'customer_identity_profile',
            'relationship_purpose',
            'customer_identity_profile', // duplicate
            'relationship_purpose', // duplicate
          ],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      // Should contain both duplicates
      const errorStr = result.errors.find(e => e.includes('duplicate topic_ids'));
      expect(errorStr).toContain('customer_identity_profile');
      expect(errorStr).toContain('relationship_purpose');
    });
  });

  describe('Referential integrity', () => {
    it('should warn when topic_id not in catalog.topics', () => {
      const catalog = {
        topics: [
          { topic_id: 'customer_identity_profile', title: 'Customer Identity' },
          { topic_id: 'relationship_purpose', title: 'Relationship Purpose' },
        ],
        topic_sets: {
          kyc_review: [
            'customer_identity_profile',
            'unknown_topic_id', // not in catalog.topics
          ],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true); // Warnings don't fail validation
      expect(result.warnings.length).toBeGreaterThan(0);
      const warningStr = result.warnings.find(w => w.includes('unknown_topic_id'));
      expect(warningStr).toBeDefined();
      expect(warningStr).toContain('references topic_ids not in catalog.topics');
    });

    it('should truncate long missing topic lists in warnings', () => {
      const catalog = {
        topics: [
          { topic_id: 'valid_topic', title: 'Valid' },
        ],
        topic_sets: {
          kyc_review: [
            'missing1',
            'missing2',
            'missing3',
            'missing4',
            'missing5',
          ],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      const warningStr = result.warnings.find(w => w.includes('references topic_ids'));
      expect(warningStr).toBeDefined();
      // Should truncate to max 3 items with "..."
      expect(warningStr).toContain('...');
    });

    it('should skip referential check if catalog.topics missing', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile', 'unknown_topic'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      // Should not warn about unknown_topic since catalog.topics doesn't exist
      const refWarnings = result.warnings.filter(w => w.includes('references topic_ids'));
      expect(refWarnings).toEqual([]);
    });

    it('should skip referential check if catalog.topics is not an array', () => {
      const catalog = {
        topics: { not_an_array: true },
        topic_sets: {
          kyc_review: ['customer_identity_profile'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      const refWarnings = result.warnings.filter(w => w.includes('references topic_ids'));
      expect(refWarnings).toEqual([]);
    });
  });

  describe('Route naming conventions', () => {
    it('should warn about route with spaces', () => {
      const catalog = {
        topic_sets: {
          'kyc review': ['customer_identity_profile'], // space instead of underscore
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      const warningStr = result.warnings.find(w => w.includes('kyc review'));
      expect(warningStr).toContain('contains spaces or hyphens');
    });

    it('should warn about route with hyphens', () => {
      const catalog = {
        topic_sets: {
          'kyc-review': ['customer_identity_profile'], // hyphen instead of underscore
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      const warningStr = result.warnings.find(w => w.includes('kyc-review'));
      expect(warningStr).toContain('contains spaces or hyphens');
    });

    it('should suggest close matches to known routes', () => {
      const catalog = {
        topic_sets: {
          kycreview: ['customer_identity_profile'], // missing underscore
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      const warningStr = result.warnings.find(w => w.includes('kycreview'));
      expect(warningStr).toContain('unknown route');
      expect(warningStr).toContain('kyc_review');
    });

    it('should not warn about known route patterns', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile'],
          case2_review: ['client_profile_legacy_context'],
          it_review: ['system_components_identifiers'],
          guardrail_check: ['general_information'],
          chat_general: ['general_information'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      // Should not warn about naming for known routes
      const namingWarnings = result.warnings.filter(w =>
        w.includes('unknown route') || w.includes('contains spaces')
      );
      expect(namingWarnings).toEqual([]);
    });
  });

  describe('Multiple errors and warnings', () => {
    it('should collect all errors and warnings', () => {
      const catalog = {
        topics: [
          { topic_id: 'valid_topic', title: 'Valid' },
        ],
        topic_sets: {
          'kyc review': [ // space warning
            'customer_identity_profile', // not in catalog.topics warning
            'customer_identity_profile', // duplicate error
          ],
          case2_review: 'not_an_array', // array error
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort errors and warnings for deterministic output', () => {
      const catalog = {
        topic_sets: {
          z_route: 'not_an_array',
          a_route: ['dup', 'dup'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(false);
      // Errors should be sorted alphabetically
      expect(result.errors[0]).toContain('a_route');
      expect(result.errors[1]).toContain('z_route');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty topic_sets object', () => {
      const catalog = {
        topic_sets: {},
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.stats?.topicSetCount).toBe(0);
    });

    it('should handle empty topic_set arrays', () => {
      const catalog = {
        topic_sets: {
          kyc_review: [],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle catalog with extra fields', () => {
      const catalog = {
        topic_sets: {
          kyc_review: ['customer_identity_profile'],
        },
        extra_field: 'ignored',
        another_field: 123,
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      // Extra fields should be ignored
    });

    it('should handle topics with missing title', () => {
      const catalog = {
        topics: [
          { topic_id: 'customer_identity_profile' }, // no title
          { topic_id: 'relationship_purpose', title: 'Relationship Purpose' },
        ],
        topic_sets: {
          kyc_review: ['customer_identity_profile', 'relationship_purpose'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      // Should not error on missing titles
    });

    it('should handle topics with malformed entries', () => {
      const catalog = {
        topics: [
          'not_an_object',
          { topic_id: 'customer_identity_profile', title: 'Valid' },
          null,
          { no_topic_id: true },
        ],
        topic_sets: {
          kyc_review: ['customer_identity_profile'],
        },
      };

      const result = validateFlow2TopicCatalog(catalog);

      expect(result.ok).toBe(true);
      expect(result.stats?.topicCount).toBe(1); // Only valid topic counted
    });
  });
});

describe('formatValidationResult', () => {
  it('should format successful validation', () => {
    const result: TopicCatalogValidationResult = {
      ok: true,
      errors: [],
      warnings: [],
      stats: {
        topicCount: 8,
        topicSetCount: 3,
      },
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('✓ Topic catalog validation passed');
    expect(formatted).toContain('Topics: 8');
    expect(formatted).toContain('Topic Sets: 3');
  });

  it('should format failed validation with errors', () => {
    const result: TopicCatalogValidationResult = {
      ok: false,
      errors: ['Missing required field: topic_sets', 'topic_sets.kyc_review: must be an array'],
      warnings: [],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('✗ Topic catalog validation failed');
    expect(formatted).toContain('Errors (2)');
    expect(formatted).toContain('Missing required field: topic_sets');
    expect(formatted).toContain('topic_sets.kyc_review: must be an array');
  });

  it('should format validation with warnings', () => {
    const result: TopicCatalogValidationResult = {
      ok: true,
      errors: [],
      warnings: [
        'topic_sets.kyc_review: references topic_ids not in catalog.topics [unknown_id]',
        'topic_sets.kycreview: unknown route (did you mean: kyc_review?)',
      ],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('✓ Topic catalog validation passed');
    expect(formatted).toContain('Warnings (2)');
    expect(formatted).toContain('references topic_ids not in catalog.topics');
    expect(formatted).toContain('unknown route');
  });

  it('should format validation with errors and warnings', () => {
    const result: TopicCatalogValidationResult = {
      ok: false,
      errors: ['topic_sets.case2_review: contains duplicate topic_ids [test]'],
      warnings: ['topic_sets.kyc-review: route name contains spaces or hyphens'],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('✗ Topic catalog validation failed');
    expect(formatted).toContain('Errors (1)');
    expect(formatted).toContain('Warnings (1)');
    expect(formatted).toContain('duplicate topic_ids');
    expect(formatted).toContain('contains spaces or hyphens');
  });

  it('should handle missing stats gracefully', () => {
    const result: TopicCatalogValidationResult = {
      ok: true,
      errors: [],
      warnings: [],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('✓ Topic catalog validation passed');
    // Should not crash without stats
  });
});
