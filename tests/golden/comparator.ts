/**
 * Phase 2 - Gate 3: Golden Regression Comparator
 *
 * Compares ONLY stable, deterministic fields.
 * Explicitly ignores LLM-generated natural language content.
 *
 * Stable fields:
 * - route_id
 * - required_skills (resolved IDs)
 * - topic_ids (set comparison)
 * - flags (set comparison)
 * - hitl (boolean)
 * - template_id
 *
 * Ignored fields:
 * - LLM summaries
 * - Email body text
 * - Explanation fields
 * - Timestamps
 * - Non-deterministic IDs (run_id, message_id)
 */

export interface GoldenTestCase {
  test_name: string;
  input: {
    trigger: string;
    context?: Record<string, any>;
  };
  expected: {
    route_id: string;
    required_skills: string[];
    topic_ids?: string[];
    flags?: string[];
    hitl?: boolean;
    template_id?: string;
  };
}

export interface ComparisonResult {
  passed: boolean;
  testName: string;
  errors: string[];
  warnings: string[];
}

// ========================================
// COMPARISON LOGIC
// ========================================

/**
 * Compare actual vs expected using stable fields only
 */
export function compareGoldenOutput(
  testCase: GoldenTestCase,
  actual: Record<string, any>
): ComparisonResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expected = testCase.expected;

  // 1. Route ID (required)
  if (actual.route_id !== expected.route_id) {
    errors.push(
      `Route ID mismatch: expected "${expected.route_id}", got "${actual.route_id}"`
    );
  }

  // 2. Required Skills (required, order-independent)
  if (expected.required_skills) {
    const actualSkills = new Set<string>(actual.required_skills || []);
    const expectedSkills = new Set<string>(expected.required_skills);

    const missing = Array.from(expectedSkills).filter(skill => !actualSkills.has(skill));
    const extra = Array.from(actualSkills).filter(skill => !expectedSkills.has(skill));

    if (missing.length > 0) {
      errors.push(`Missing required_skills: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      warnings.push(`Extra required_skills: ${extra.join(', ')}`);
    }
  }

  // 3. Topic IDs (optional, order-independent)
  if (expected.topic_ids) {
    const actualTopics = new Set<string>(actual.topic_ids || []);
    const expectedTopics = new Set<string>(expected.topic_ids);

    const missing = Array.from(expectedTopics).filter(topic => !actualTopics.has(topic));
    const extra = Array.from(actualTopics).filter(topic => !expectedTopics.has(topic));

    if (missing.length > 0) {
      errors.push(`Missing topic_ids: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      warnings.push(`Extra topic_ids: ${extra.join(', ')}`);
    }
  }

  // 4. Flags (optional, order-independent)
  if (expected.flags) {
    const actualFlags = new Set<string>(actual.flags || []);
    const expectedFlags = new Set<string>(expected.flags);

    const missing = Array.from(expectedFlags).filter(flag => !actualFlags.has(flag));
    const extra = Array.from(actualFlags).filter(flag => !expectedFlags.has(flag));

    if (missing.length > 0) {
      errors.push(`Missing flags: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      warnings.push(`Extra flags: ${extra.join(', ')}`);
    }
  }

  // 5. HITL (optional, boolean)
  if (expected.hitl !== undefined) {
    if (actual.hitl !== expected.hitl) {
      errors.push(
        `HITL mismatch: expected ${expected.hitl}, got ${actual.hitl}`
      );
    }
  }

  // 6. Template ID (optional)
  if (expected.template_id) {
    if (actual.template_id !== expected.template_id) {
      errors.push(
        `Template ID mismatch: expected "${expected.template_id}", got "${actual.template_id}"`
      );
    }
  }

  return {
    passed: errors.length === 0,
    testName: testCase.test_name,
    errors,
    warnings,
  };
}

/**
 * Compare batch of test cases
 */
export function compareGoldenBatch(
  testCases: GoldenTestCase[],
  actualOutputs: Record<string, any>[]
): ComparisonResult[] {
  if (testCases.length !== actualOutputs.length) {
    throw new Error(
      `Test case count mismatch: ${testCases.length} test cases, ${actualOutputs.length} outputs`
    );
  }

  return testCases.map((testCase, idx) =>
    compareGoldenOutput(testCase, actualOutputs[idx])
  );
}

// ========================================
// RESULT DISPLAY
// ========================================

/**
 * Format comparison results for console output
 */
export function formatResults(results: ComparisonResult[]): string {
  const lines: string[] = [];
  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Golden Regression Results: ${passCount}/${totalCount} passed`);
  lines.push('═══════════════════════════════════════════════════════════════\n');

  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    lines.push(`${icon} Test ${idx + 1}: ${result.testName}`);

    if (result.errors.length > 0) {
      lines.push('  ERRORS:');
      result.errors.forEach(error => {
        lines.push(`    - ${error}`);
      });
    }

    if (result.warnings.length > 0) {
      lines.push('  WARNINGS:');
      result.warnings.forEach(warning => {
        lines.push(`    - ${warning}`);
      });
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Check if all tests passed
 */
export function allTestsPassed(results: ComparisonResult[]): boolean {
  return results.every(r => r.passed);
}
