import { describe, it, expect } from 'vitest';
import { resolveAgentByRouteId } from '@/app/agents/registry';
import { executeAgentPlan } from '@/app/agents/runtime/engine';

/**
 * Agent Engine Tests (Phase 5.2)
 *
 * Tests for deterministic agent execution engine.
 */
describe('Agent Engine', () => {
  it('executes kyc_review agent successfully', async () => {
    const agent = resolveAgentByRouteId('kyc_review');
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'kyc_review',
      runId: 'test-run-1',
      initial: {},
    });

    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('kyc_review');
    expect(result.agentId).toBe('kyc_agent');

    // Check outputs for each step
    expect(result.outputs).toHaveProperty('topic_summaries');
    expect(result.outputs).toHaveProperty('risk_triage');
    expect(result.outputs).toHaveProperty('human_review');

    // Verify topic_summaries output
    expect(result.outputs.topic_summaries).toHaveProperty('topic_ids');
    expect(Array.isArray(result.outputs.topic_summaries.topic_ids)).toBe(true);
    expect(result.outputs.topic_summaries.topic_ids.length).toBeGreaterThan(0);

    // Verify risk_triage output
    expect(result.outputs.risk_triage).toHaveProperty('risk');
    expect(['low', 'medium', 'high']).toContain(result.outputs.risk_triage.risk);

    // Verify human_review was skipped
    expect(result.outputs.human_review.skipped).toBe(true);
  });

  it('executes case2_review agent successfully', async () => {
    const agent = resolveAgentByRouteId('case2_review');
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'case2_review',
      runId: 'test-run-2',
      initial: {},
    });

    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('case2_review');
    expect(result.agentId).toBe('case2_agent');

    // Check outputs
    expect(result.outputs).toHaveProperty('topic_summaries');
    expect(result.outputs).toHaveProperty('cs_integration');
    expect(result.outputs).toHaveProperty('approval_path');

    // Verify topic_ids
    expect(Array.isArray(result.outputs.topic_summaries.topic_ids)).toBe(true);
    expect(result.outputs.topic_summaries.topic_ids.length).toBeGreaterThan(0);
  });

  it('executes it_review agent successfully', async () => {
    const agent = resolveAgentByRouteId('it_review');
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'it_review',
      runId: 'test-run-3',
      initial: {},
    });

    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('it_review');
    expect(result.agentId).toBe('it_agent');

    // Check outputs
    expect(result.outputs).toHaveProperty('topic_summaries');
    expect(result.outputs).toHaveProperty('impact_analysis');
    expect(result.outputs).toHaveProperty('validation');

    // Verify topic_ids
    expect(Array.isArray(result.outputs.topic_summaries.topic_ids)).toBe(true);
    expect(result.outputs.topic_summaries.topic_ids.length).toBeGreaterThan(0);
  });

  it('executes guardrail_check agent successfully', async () => {
    const agent = resolveAgentByRouteId('guardrail_check');
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'guardrail_check',
      runId: 'test-run-4',
      initial: {},
    });

    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('guardrail_check');
    expect(result.agentId).toBe('guardrail_agent');

    // Check outputs
    expect(result.outputs).toHaveProperty('alert_detection');
    expect(result.outputs).toHaveProperty('human_resolution');

    // Guardrail agent should detect alert
    expect(result.outputs.alert_detection.alert_detected).toBe(true);
  });

  it('executes chat_general agent successfully', async () => {
    const agent = resolveAgentByRouteId('chat_general');
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'chat_general',
      runId: 'test-run-5',
      initial: { query: 'What is the status?' },
    });

    expect(result.ok).toBe(true);
    expect(result.routeId).toBe('chat_general');
    expect(result.agentId).toBe('chat_general_agent');

    // Check outputs
    expect(result.outputs).toHaveProperty('topic_summaries');
    expect(result.outputs).toHaveProperty('chat_response');

    // Verify topic_ids
    expect(Array.isArray(result.outputs.topic_summaries.topic_ids)).toBe(true);
    expect(result.outputs.topic_summaries.topic_ids.length).toBeGreaterThan(0);
  });

  it('returns ok=false when routeId mismatches agent flow routeId', async () => {
    const agent = resolveAgentByRouteId('kyc_review');

    // Try to execute with wrong routeId
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'wrong_route', // Mismatch
      runId: 'test-run-mismatch',
      initial: {},
    });

    expect(result.ok).toBe(false);
    expect(result.outputs).toHaveProperty('error');
    expect(result.outputs.error.message).toContain('RouteId mismatch');
  });

  it('is deterministic - same input produces same output', async () => {
    const agent = resolveAgentByRouteId('kyc_review');

    const result1 = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'kyc_review',
      runId: 'test-determinism',
      initial: {},
    });

    const result2 = await executeAgentPlan({
      agentId: agent.id,
      routeId: 'kyc_review',
      runId: 'test-determinism',
      initial: {},
    });

    // Same agent, route, runId, initial -> same outputs
    expect(result1.ok).toBe(result2.ok);
    expect(result1.routeId).toBe(result2.routeId);
    expect(result1.agentId).toBe(result2.agentId);

    // Topic IDs should be identical (deterministic resolution)
    expect(result1.outputs.topic_summaries.topic_ids).toEqual(
      result2.outputs.topic_summaries.topic_ids
    );
  });
});
