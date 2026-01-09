import { describe, it, expect } from 'vitest';
import { buildDeriveContext } from '../../app/lib/topicSummaries/buildDeriveContext';
import { deriveFlow2RouteId } from '../../app/lib/topicSummaries/deriveFlow2RouteId';

/**
 * Phase 3.7: buildDeriveContext unit tests
 *
 * Verifies single source of truth for context construction.
 * Ensures output is compatible with deriveFlow2RouteId.
 */

describe('buildDeriveContext', () => {
  it('should return context with same boolean values', () => {
    const result = buildDeriveContext({
      isFlow2: true,
      case3Active: false,
      case4Active: true,
      case2Active: false,
    });

    expect(result.isFlow2).toBe(true);
    expect(result.case3Active).toBe(false);
    expect(result.case4Active).toBe(true);
    expect(result.case2Active).toBe(false);
  });

  it('should produce object accepted by deriveFlow2RouteId (smoke test)', () => {
    const ctx = buildDeriveContext({
      isFlow2: true,
      case3Active: false,
      case4Active: false,
      case2Active: false,
    });

    // Should not throw
    const routeId = deriveFlow2RouteId(ctx);
    expect(routeId).toBe('kyc_review');
  });

  it('should handle all-false state', () => {
    const result = buildDeriveContext({
      isFlow2: false,
      case3Active: false,
      case4Active: false,
      case2Active: false,
    });

    expect(result.isFlow2).toBe(false);
    expect(result.case3Active).toBe(false);
    expect(result.case4Active).toBe(false);
    expect(result.case2Active).toBe(false);
  });

  it('should handle all-true state', () => {
    const result = buildDeriveContext({
      isFlow2: true,
      case3Active: true,
      case4Active: true,
      case2Active: true,
    });

    expect(result.isFlow2).toBe(true);
    expect(result.case3Active).toBe(true);
    expect(result.case4Active).toBe(true);
    expect(result.case2Active).toBe(true);
  });

  it('should be compatible with deriveFlow2RouteId priority chain', () => {
    // Case 3 (guardrail) should dominate
    const ctx1 = buildDeriveContext({
      isFlow2: true,
      case3Active: true,
      case4Active: true,
      case2Active: true,
    });
    expect(deriveFlow2RouteId(ctx1)).toBe('guardrail_check');

    // Case 4 (IT) should dominate over case2
    const ctx2 = buildDeriveContext({
      isFlow2: true,
      case3Active: false,
      case4Active: true,
      case2Active: true,
    });
    expect(deriveFlow2RouteId(ctx2)).toBe('it_review');
  });
});
