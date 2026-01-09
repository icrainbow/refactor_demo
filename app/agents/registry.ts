/**
 * Phase 5.1: Agent Registry
 *
 * Central registry mapping routes to agents with deterministic flows.
 * Single source of truth for agent resolution.
 */

import type { AgentDefinition, AgentId } from './types';

/**
 * Agent registry
 * Maps routes to agents with flow definitions
 */
export const AGENTS: AgentDefinition[] = [
  {
    id: 'kyc_agent',
    title: 'KYC Review Agent',
    routeIds: ['kyc_review'],
    flow: {
      id: 'kyc_review_flow',
      routeId: 'kyc_review',
      steps: [
        { id: 'topic_summaries', kind: 'tool', ref: 'topic_summaries' },
        { id: 'risk_triage', kind: 'tool', ref: 'risk_triage' },
        { id: 'human_review', kind: 'human', ref: 'HITL' },
      ],
    },
    skills: ['kyc_review.skill.md'],
  },
  {
    id: 'case2_agent',
    title: 'Case2 CS Integration Agent',
    routeIds: ['case2_review'],
    flow: {
      id: 'case2_review_flow',
      routeId: 'case2_review',
      steps: [
        { id: 'topic_summaries', kind: 'tool', ref: 'topic_summaries' },
        { id: 'cs_integration', kind: 'tool', ref: 'cs_integration' },
        { id: 'approval_path', kind: 'human', ref: 'governance' },
      ],
    },
    skills: ['case2_review.skill.md'],
  },
  {
    id: 'it_agent',
    title: 'IT Bulletin Review Agent',
    routeIds: ['it_review'],
    flow: {
      id: 'it_review_flow',
      routeId: 'it_review',
      steps: [
        { id: 'topic_summaries', kind: 'tool', ref: 'topic_summaries' },
        { id: 'impact_analysis', kind: 'tool', ref: 'impact_analysis' },
        { id: 'validation', kind: 'tool', ref: 'validation', optional: true },
      ],
    },
    skills: ['it_review.skill.md'],
  },
  {
    id: 'guardrail_agent',
    title: 'Guardrail Check Agent',
    routeIds: ['guardrail_check'],
    flow: {
      id: 'guardrail_check_flow',
      routeId: 'guardrail_check',
      steps: [
        { id: 'alert_detection', kind: 'tool', ref: 'guardrail_detector' },
        { id: 'human_resolution', kind: 'human', ref: 'guardrail_review' },
      ],
    },
    skills: ['guardrail_check.skill.md'],
  },
  {
    id: 'chat_general_agent',
    title: 'General Chat Agent',
    routeIds: ['chat_general'],
    flow: {
      id: 'chat_general_flow',
      routeId: 'chat_general',
      steps: [
        { id: 'topic_summaries', kind: 'tool', ref: 'topic_summaries' },
        { id: 'chat_response', kind: 'skill', ref: 'chat_skill' },
      ],
    },
    skills: ['chat_general.skill.md'],
  },
];

/**
 * Resolve agent by route ID
 *
 * @param routeId - Route identifier (from deriveFlow2RouteId)
 * @returns Agent definition for the route
 * @throws Error if no agent found for routeId (fail-fast)
 */
export function resolveAgentByRouteId(routeId: string): AgentDefinition {
  const agent = AGENTS.find((a) => a.routeIds.includes(routeId));

  if (!agent) {
    throw new Error(
      `No agent found for route: ${routeId}. Available routes: ${AGENTS.flatMap((a) => a.routeIds).join(', ')}`
    );
  }

  return agent;
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentDefinition[] {
  return [...AGENTS];
}

/**
 * Get agent by ID
 *
 * @param agentId - Agent identifier
 * @returns Agent definition
 * @throws Error if agent not found
 */
export function getAgentById(agentId: AgentId): AgentDefinition {
  const agent = AGENTS.find((a) => a.id === agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return agent;
}
