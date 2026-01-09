import { describe, it, expect } from 'vitest';
import { resolveAgentByRouteId } from '@/app/agents/registry';
import type { AgentId } from '@/app/agents/types';

/**
 * Contract Tests: Route → Agent Resolution (Phase 5.1)
 *
 * Purpose: Verify that resolveAgentByRouteId correctly maps route IDs to agents
 * and that the mapping is deterministic and fails safely.
 */
describe('routeToAgent contract', () => {
  it('resolves kyc_review to kyc_agent', () => {
    const agent = resolveAgentByRouteId('kyc_review');
    expect(agent.id).toBe('kyc_agent');
    expect(agent.routeIds).toContain('kyc_review');
  });

  it('resolves case2_review to case2_agent', () => {
    const agent = resolveAgentByRouteId('case2_review');
    expect(agent.id).toBe('case2_agent');
    expect(agent.routeIds).toContain('case2_review');
  });

  it('resolves it_review to it_agent', () => {
    const agent = resolveAgentByRouteId('it_review');
    expect(agent.id).toBe('it_agent');
    expect(agent.routeIds).toContain('it_review');
  });

  it('resolves guardrail_check to guardrail_agent', () => {
    const agent = resolveAgentByRouteId('guardrail_check');
    expect(agent.id).toBe('guardrail_agent');
    expect(agent.routeIds).toContain('guardrail_check');
  });

  it('resolves chat_general to chat_general_agent', () => {
    const agent = resolveAgentByRouteId('chat_general');
    expect(agent.id).toBe('chat_general_agent');
    expect(agent.routeIds).toContain('chat_general');
  });

  it('is deterministic - same routeId always returns same agent.id', () => {
    const routeIds = ['kyc_review', 'case2_review', 'it_review', 'guardrail_check', 'chat_general'];

    routeIds.forEach((routeId) => {
      const agent1 = resolveAgentByRouteId(routeId);
      const agent2 = resolveAgentByRouteId(routeId);
      const agent3 = resolveAgentByRouteId(routeId);

      expect(agent1.id).toBe(agent2.id);
      expect(agent2.id).toBe(agent3.id);
    });
  });

  it('throws descriptive error for unknown routeId', () => {
    expect(() => resolveAgentByRouteId('unknown_route')).toThrow();
    expect(() => resolveAgentByRouteId('unknown_route')).toThrow(/No agent found for route: unknown_route/);
  });

  it('all agents have valid flow definitions', () => {
    const routeIds = ['kyc_review', 'case2_review', 'it_review', 'guardrail_check', 'chat_general'];

    routeIds.forEach((routeId) => {
      const agent = resolveAgentByRouteId(routeId);

      // Flow must exist and have required properties
      expect(agent.flow).toBeDefined();
      expect(agent.flow.id).toBeTruthy();
      expect(agent.flow.routeId).toBe(routeId);
      expect(Array.isArray(agent.flow.steps)).toBe(true);
      expect(agent.flow.steps.length).toBeGreaterThan(0);

      // Each step must be well-formed
      agent.flow.steps.forEach((step) => {
        expect(step.id).toBeTruthy();
        expect(['skill', 'tool', 'human']).toContain(step.kind);
        expect(step.ref).toBeTruthy();
      });
    });
  });
});
