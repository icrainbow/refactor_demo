import { describe, it, expect } from 'vitest';
import { SKILLS, resolveSkillHandler } from '@/app/agents/runtime/skillRegistry';
import { resolveTopicSet } from '@/app/lib/topicSummaries/topicSetResolver';

/**
 * Skill Registry Tests (Phase 5.2)
 *
 * Tests for skill handler registry and individual handlers.
 */
describe('Skill Registry', () => {
  it('resolves all registered skill handlers', () => {
    const skillRefs = [
      'topic_summaries',
      'risk_triage',
      'process_recommendation',
      'guardrail_check',
      'chat_reply_stub',
      'cs_integration',
      'impact_analysis',
      'validation',
      'guardrail_detector',
      'chat_skill',
    ];

    skillRefs.forEach((ref) => {
      const handler = resolveSkillHandler(ref);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });

  it('throws error for unknown skill ref', () => {
    expect(() => resolveSkillHandler('unknown_skill')).toThrow();
    expect(() => resolveSkillHandler('unknown_skill')).toThrow(
      /No skill handler found for ref: unknown_skill/
    );
  });

  it('topic_summaries handler returns topic_ids consistent with topicSetResolver', async () => {
    const routeId = 'kyc_review';
    const handler = SKILLS.topic_summaries;

    // Call handler
    const result = await handler(
      {},
      { routeId, agentId: 'kyc_agent', runId: 'test-1' }
    );

    // Verify result structure
    expect(result).toHaveProperty('topic_ids');
    expect(Array.isArray(result.topic_ids)).toBe(true);

    // Compare with topicSetResolver (should be identical)
    const expectedTopicSet = resolveTopicSet(routeId);
    expect(result.topic_ids).toEqual(expectedTopicSet.topic_ids);
  });

  it('risk_triage handler returns deterministic risk level', async () => {
    const handler = SKILLS.risk_triage;

    // Test kyc_review route
    const result1 = await handler(
      { topic_ids: ['topic1', 'topic2', 'topic3', 'topic4', 'topic5'] },
      { routeId: 'kyc_review', agentId: 'kyc_agent', runId: 'test-2' }
    );

    expect(result1).toHaveProperty('risk');
    expect(['low', 'medium', 'high']).toContain(result1.risk);
    expect(result1).toHaveProperty('reasons');
    expect(Array.isArray(result1.reasons)).toBe(true);

    // Test guardrail_check route (should be high risk)
    const result2 = await handler(
      {},
      { routeId: 'guardrail_check', agentId: 'guardrail_agent', runId: 'test-3' }
    );

    expect(result2.risk).toBe('high');
  });

  it('process_recommendation handler returns deterministic recommendation', async () => {
    const handler = SKILLS.process_recommendation;

    const testCases = [
      { routeId: 'kyc_review', expected: 'fast_track' },
      { routeId: 'case2_review', expected: 'governance_review' },
      { routeId: 'it_review', expected: 'impact_assessment' },
      { routeId: 'guardrail_check', expected: 'human_gate' },
      { routeId: 'chat_general', expected: 'auto_reply' },
    ];

    for (const { routeId, expected } of testCases) {
      const result = await handler(
        {},
        { routeId, agentId: 'test_agent', runId: 'test-4' }
      );

      expect(result.recommended).toBe(expected);
    }
  });

  it('guardrail_check handler respects simulate_deny flag', async () => {
    const handler = SKILLS.guardrail_check;

    // Test without flag
    const result1 = await handler(
      { simulate_deny: false },
      { routeId: 'kyc_review', agentId: 'kyc_agent', runId: 'test-5' }
    );
    expect(result1.allowed).toBe(true);

    // Test with flag
    const result2 = await handler(
      { simulate_deny: true },
      { routeId: 'kyc_review', agentId: 'kyc_agent', runId: 'test-6' }
    );
    expect(result2.allowed).toBe(false);
    expect(result2.reasons).toContain('Simulated denial (test flag)');
  });

  it('guardrail_detector handler detects alerts for guardrail_check route', async () => {
    const handler = SKILLS.guardrail_detector;

    // Test guardrail_check route
    const result1 = await handler(
      {},
      { routeId: 'guardrail_check', agentId: 'guardrail_agent', runId: 'test-7' }
    );
    expect(result1.alert_detected).toBe(true);
    expect(result1.severity).toBe('high');

    // Test non-guardrail route
    const result2 = await handler(
      {},
      { routeId: 'kyc_review', agentId: 'kyc_agent', runId: 'test-8' }
    );
    expect(result2.alert_detected).toBe(false);
    expect(result2.severity).toBe('none');
  });

  it('chat_skill handler includes query in response', async () => {
    const handler = SKILLS.chat_skill;

    const result = await handler(
      { query: 'What is my status?' },
      { routeId: 'chat_general', agentId: 'chat_general_agent', runId: 'test-9' }
    );

    expect(result).toHaveProperty('response');
    expect(result.response).toContain('What is my status?');
    expect(result).toHaveProperty('confidence');
  });

  it('all handlers return SkillOutput (Record<string, unknown>)', async () => {
    const handlers = Object.entries(SKILLS);

    for (const [ref, handler] of handlers) {
      const result = await handler(
        {},
        { routeId: 'kyc_review', agentId: 'kyc_agent', runId: `test-${ref}` }
      );

      // Verify result is an object (not null, not array)
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    }
  });
});
