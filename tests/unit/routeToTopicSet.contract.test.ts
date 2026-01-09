import { describe, it, expect } from 'vitest';
import { deriveFlow2RouteId } from '../../app/lib/topicSummaries/deriveFlow2RouteId';
import { resolveTopicSet } from '../../app/lib/topicSummaries/topicSetResolver';
import { buildDeriveContext } from '../../app/lib/topicSummaries/buildDeriveContext';

/**
 * Phase 3.7: Route → TopicSet Contract Tests
 *
 * Ensures route derivation → topic resolution pipeline remains stable.
 * Does NOT assert exact topic_ids content (to avoid brittle changes).
 * Only verifies: routeId correctness + topic_ids is non-empty array.
 */

describe('Route → TopicSet Contract', () => {
  describe('KYC Review Route', () => {
    it('should resolve to kyc_review with non-empty topic_ids', () => {
      const ctx = buildDeriveContext({
        isFlow2: true,
        case3Active: false,
        case4Active: false,
        case2Active: false,
      });

      const routeId = deriveFlow2RouteId(ctx);
      expect(routeId).toBe('kyc_review');

      const topicSet = resolveTopicSet(routeId);
      expect(Array.isArray(topicSet.topic_ids)).toBe(true);
      expect(topicSet.topic_ids.length).toBeGreaterThan(0);
    });
  });

  describe('Case2 Review Route', () => {
    it('should resolve to case2_review with non-empty topic_ids', () => {
      const ctx = buildDeriveContext({
        isFlow2: true,
        case3Active: false,
        case4Active: false,
        case2Active: true,
      });

      const routeId = deriveFlow2RouteId(ctx);
      expect(routeId).toBe('case2_review');

      const topicSet = resolveTopicSet(routeId);
      expect(Array.isArray(topicSet.topic_ids)).toBe(true);
      expect(topicSet.topic_ids.length).toBeGreaterThan(0);
    });
  });

  describe('IT Review Route', () => {
    it('should resolve to it_review with non-empty topic_ids (case4 dominates case2)', () => {
      const ctx = buildDeriveContext({
        isFlow2: true,
        case3Active: false,
        case4Active: true,
        case2Active: true,
      });

      const routeId = deriveFlow2RouteId(ctx);
      expect(routeId).toBe('it_review');

      const topicSet = resolveTopicSet(routeId);
      expect(Array.isArray(topicSet.topic_ids)).toBe(true);
      expect(topicSet.topic_ids.length).toBeGreaterThan(0);
    });
  });

  describe('Guardrail Check Route', () => {
    it('should resolve to guardrail_check with non-empty topic_ids (case3 dominates all)', () => {
      const ctx = buildDeriveContext({
        isFlow2: true,
        case3Active: true,
        case4Active: true,
        case2Active: true,
      });

      const routeId = deriveFlow2RouteId(ctx);
      expect(routeId).toBe('guardrail_check');

      const topicSet = resolveTopicSet(routeId);
      expect(Array.isArray(topicSet.topic_ids)).toBe(true);
      expect(topicSet.topic_ids.length).toBeGreaterThan(0);
    });
  });

  describe('Chat General Route (Fallback)', () => {
    it('should resolve to chat_general with non-empty topic_ids', () => {
      const ctx = buildDeriveContext({
        isFlow2: false,
        case3Active: false,
        case4Active: false,
        case2Active: false,
      });

      const routeId = deriveFlow2RouteId(ctx);
      expect(routeId).toBe('chat_general');

      const topicSet = resolveTopicSet(routeId);
      expect(Array.isArray(topicSet.topic_ids)).toBe(true);
      expect(topicSet.topic_ids.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Pipeline Stability', () => {
    it('should never throw when building ctx -> deriving route -> resolving topics', () => {
      const scenarios = [
        { isFlow2: true, case3Active: false, case4Active: false, case2Active: false },
        { isFlow2: true, case3Active: false, case4Active: false, case2Active: true },
        { isFlow2: true, case3Active: false, case4Active: true, case2Active: false },
        { isFlow2: true, case3Active: true, case4Active: false, case2Active: false },
        { isFlow2: false, case3Active: false, case4Active: false, case2Active: false },
      ];

      scenarios.forEach((args) => {
        expect(() => {
          const ctx = buildDeriveContext(args);
          const routeId = deriveFlow2RouteId(ctx);
          const topicSet = resolveTopicSet(routeId);
          expect(topicSet.topic_ids.length).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });
});
