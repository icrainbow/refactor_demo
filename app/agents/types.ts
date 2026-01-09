/**
 * Phase 5.1: Agent Registry Types
 *
 * Minimal type definitions for agent-based routing.
 * Agents map routeIds to flow definitions with deterministic steps.
 */

/**
 * Agent identifier
 * Each agent handles specific review workflows
 */
export type AgentId =
  | 'kyc_agent'
  | 'case2_agent'
  | 'it_agent'
  | 'guardrail_agent'
  | 'chat_general_agent';

/**
 * Flow step definition
 * Represents a single step in an agent's execution flow
 */
export interface FlowStep {
  /** Step identifier */
  id: string;
  /** Step kind: skill execution, tool call, or human interaction */
  kind: 'skill' | 'tool' | 'human';
  /** Reference to the step resource (skill file, tool name, or human gate) */
  ref: string;
  /** Whether step can be skipped based on conditions */
  optional?: boolean;
}

/**
 * Flow definition
 * Ordered sequence of steps for an agent execution
 */
export interface FlowDefinition {
  /** Flow identifier */
  id: string;
  /** Route this flow handles */
  routeId: string;
  /** Ordered steps */
  steps: FlowStep[];
}

/**
 * Agent definition
 * Complete specification of an agent's capabilities and execution flow
 */
export interface AgentDefinition {
  /** Agent identifier */
  id: AgentId;
  /** Human-readable title */
  title: string;
  /** Routes this agent handles */
  routeIds: string[];
  /** Execution flow definition */
  flow: FlowDefinition;
  /** Optional skill file references */
  skills?: string[];
}
