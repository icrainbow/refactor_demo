/**
 * Agent Execution Engine (Phase 5.2)
 *
 * Deterministic execution of agent flows.
 * Executes flow steps sequentially, handling skills, tools, and human gates.
 */

import { getAgentById } from '../registry';
import { resolveSkillHandler } from './skillRegistry';
import type { ExecutePlanInput, ExecutePlanResult, SkillOutput } from './types';

/**
 * Execute an agent's flow plan
 *
 * Loads agent by ID, validates routeId, executes steps sequentially.
 * All execution is deterministic - no randomness, no LLM calls.
 *
 * @param input - Execution plan input with agentId, routeId, runId, and initial data
 * @returns Execution result with ok flag and step outputs
 */
export async function executeAgentPlan(
  input: ExecutePlanInput
): Promise<ExecutePlanResult> {
  const { agentId, routeId, runId, initial } = input;

  try {
    // Load agent by ID
    const agent = getAgentById(agentId);

    // Validate routeId matches agent's flow
    if (agent.flow.routeId !== routeId) {
      throw new Error(
        `RouteId mismatch: agent ${agentId} expects route ${agent.flow.routeId}, got ${routeId}`
      );
    }

    // Execution context
    const ctx = { routeId, agentId, runId };

    // Outputs map: step.id -> output
    const outputs: Record<string, SkillOutput> = {};

    // Current input (accumulates outputs from previous steps)
    let currentInput = { ...initial };

    // Execute steps sequentially
    for (const step of agent.flow.steps) {
      try {
        if (step.kind === 'skill' || step.kind === 'tool') {
          // Execute skill/tool handler
          const handler = resolveSkillHandler(step.ref);
          const output = await handler(currentInput, ctx);

          // Store output
          outputs[step.id] = output;

          // Merge output into current input for next step
          currentInput = { ...currentInput, ...output };
        } else if (step.kind === 'human') {
          // Human step: skip but record
          outputs[step.id] = {
            skipped: true,
            kind: 'human',
            ref: step.ref,
            reason: 'Human gate not executed in automated flow',
          };
        } else {
          // Unknown step kind
          throw new Error(`Unknown step kind: ${step.kind} for step ${step.id}`);
        }
      } catch (stepError) {
        // If step is optional, record error and continue
        if (step.optional) {
          outputs[step.id] = {
            skipped: true,
            error: stepError instanceof Error ? stepError.message : String(stepError),
            reason: 'Optional step failed',
          };
          continue;
        }

        // Non-optional step failed: throw
        throw stepError;
      }
    }

    // Success: all steps executed
    return {
      ok: true,
      routeId,
      agentId,
      runId,
      outputs,
    };
  } catch (error) {
    // Execution failed
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      routeId,
      agentId,
      runId,
      outputs: {
        error: {
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
}
