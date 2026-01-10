/**
 * Runtime Types for Skill Execution Engine (Phase 5.2)
 *
 * Defines contracts for skill handlers, execution context, and plan results.
 */

import type { AgentId } from '../types';

export type SkillId = string;

export type SkillInput = Record<string, unknown>;

export type SkillOutput = Record<string, unknown>;

export interface SkillContext {
  routeId: string;
  agentId: AgentId;
  runId: string;
}

export type SkillHandler = (
  input: SkillInput,
  ctx: SkillContext
) => Promise<SkillOutput>;

export type SkillRegistry = Record<string, SkillHandler>;

export interface ExecutePlanInput {
  agentId: AgentId;
  routeId: string;
  runId: string;
  initial: SkillInput;
}

export interface ExecutePlanResult {
  ok: boolean;
  routeId: string;
  agentId: AgentId;
  runId: string;
  outputs: Record<string, SkillOutput>;
}
