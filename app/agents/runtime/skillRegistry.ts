/**
 * Skill Registry (Phase 5.2)
 *
 * In-memory registry of skill handlers for agent execution.
 * All handlers are deterministic - no LLM calls, no randomness.
 */

import { resolveTopicSet } from '@/app/lib/topicSummaries/topicSetResolver';
import type { SkillHandler, SkillRegistry } from './types';

/**
 * topic_summaries skill
 * Returns topic_ids for the given routeId using existing topicSetResolver
 */
const topicSummariesHandler: SkillHandler = async (input, ctx) => {
  const topicSet = resolveTopicSet(ctx.routeId);
  return {
    topic_ids: topicSet.topic_ids,
    routeId: ctx.routeId,
  };
};

/**
 * risk_triage skill
 * Deterministic risk assessment based on topic count and routeId
 */
const riskTriageHandler: SkillHandler = async (input, ctx) => {
  // Get topic_ids from previous step or derive from routeId
  const topicIds = (input.topic_ids as string[]) || resolveTopicSet(ctx.routeId).topic_ids;
  const topicCount = topicIds.length;

  // Deterministic rules (no LLM)
  let risk: 'low' | 'medium' | 'high';
  const reasons: string[] = [];

  if (ctx.routeId === 'guardrail_check') {
    risk = 'high';
    reasons.push('Guardrail alert detected');
  } else if (ctx.routeId === 'case2_review') {
    risk = 'medium';
    reasons.push('Case2 CS integration requires governance review');
  } else if (topicCount >= 8) {
    risk = 'medium';
    reasons.push(`High topic coverage (${topicCount} topics)`);
  } else if (topicCount >= 5) {
    risk = 'low';
    reasons.push(`Standard topic coverage (${topicCount} topics)`);
  } else {
    risk = 'low';
    reasons.push(`Minimal topic coverage (${topicCount} topics)`);
  }

  return { risk, reasons, topicCount };
};

/**
 * process_recommendation skill
 * Deterministic process recommendation per routeId
 */
const processRecommendationHandler: SkillHandler = async (input, ctx) => {
  const recommendations: Record<string, string> = {
    kyc_review: 'fast_track',
    case2_review: 'governance_review',
    it_review: 'impact_assessment',
    guardrail_check: 'human_gate',
    chat_general: 'auto_reply',
  };

  const recommended = recommendations[ctx.routeId] || 'manual_review';

  return {
    recommended,
    routeId: ctx.routeId,
    reason: `Deterministic routing for ${ctx.routeId}`,
  };
};

/**
 * guardrail_check skill
 * Deterministic guardrail validation
 * Denies if routeId === 'guardrail_check' and input.simulate_deny === true
 */
const guardrailCheckHandler: SkillHandler = async (input, ctx) => {
  const reasons: string[] = [];
  let allowed = true;

  if (ctx.routeId === 'guardrail_check') {
    allowed = false;
    reasons.push('Guardrail alert triggered for this route');
  }

  // Simulation flag for testing
  if (input.simulate_deny === true) {
    allowed = false;
    reasons.push('Simulated denial (test flag)');
  }

  if (allowed) {
    reasons.push('No guardrail violations detected');
  }

  return { allowed, reasons };
};

/**
 * chat_reply_stub skill
 * Deterministic chat reply template
 */
const chatReplyStubHandler: SkillHandler = async (input, ctx) => {
  const query = (input.query as string) || 'general inquiry';

  return {
    message: `Thank you for your inquiry about "${query}". This is a deterministic stub response for route: ${ctx.routeId}.`,
    routeId: ctx.routeId,
  };
};

/**
 * cs_integration skill (Case2)
 * Deterministic CS system integration check
 */
const csIntegrationHandler: SkillHandler = async (input, ctx) => {
  return {
    cs_status: 'verified',
    legacy_migrated: true,
    reason: 'Deterministic CS integration stub for case2_review',
  };
};

/**
 * impact_analysis skill (IT)
 * Deterministic IT impact assessment
 */
const impactAnalysisHandler: SkillHandler = async (input, ctx) => {
  return {
    impact_level: 'medium',
    affected_systems: ['system_a', 'system_b'],
    reason: 'Deterministic impact analysis stub for it_review',
  };
};

/**
 * validation skill (IT, optional)
 * Deterministic cross-system validation
 */
const validationHandler: SkillHandler = async (input, ctx) => {
  return {
    validated: true,
    checks_passed: 3,
    reason: 'Deterministic validation stub',
  };
};

/**
 * guardrail_detector skill
 * Deterministic guardrail alert detection
 */
const guardrailDetectorHandler: SkillHandler = async (input, ctx) => {
  const alert = ctx.routeId === 'guardrail_check';
  return {
    alert_detected: alert,
    severity: alert ? 'high' : 'none',
    reason: alert ? 'Guardrail route triggered' : 'No alerts',
  };
};

/**
 * chat_skill skill
 * Deterministic chat response for general queries
 */
const chatSkillHandler: SkillHandler = async (input, ctx) => {
  const query = (input.query as string) || 'general inquiry';
  return {
    response: `This is a deterministic chat response for: "${query}"`,
    confidence: 0.95,
  };
};

/**
 * SKILLS Registry
 * Maps skill ref names to handler functions
 */
export const SKILLS: SkillRegistry = {
  topic_summaries: topicSummariesHandler,
  risk_triage: riskTriageHandler,
  process_recommendation: processRecommendationHandler,
  guardrail_check: guardrailCheckHandler,
  chat_reply_stub: chatReplyStubHandler,
  cs_integration: csIntegrationHandler,
  impact_analysis: impactAnalysisHandler,
  validation: validationHandler,
  guardrail_detector: guardrailDetectorHandler,
  chat_skill: chatSkillHandler,
};

/**
 * Resolve skill handler by ref name
 * Throws if skill not found (fail-fast)
 */
export function resolveSkillHandler(ref: string): SkillHandler {
  const handler = SKILLS[ref];
  if (!handler) {
    throw new Error(
      `No skill handler found for ref: ${ref}. Available skills: ${Object.keys(SKILLS).join(', ')}`
    );
  }
  return handler;
}
