/**
 * Skills Framework - Bundle Schemas
 *
 * Zod schemas for runtime validation of governance bundles
 */

import { z } from 'zod';

// ========================================
// ROUTING SCHEMA
// ========================================

export const RouteSchema = z.object({
  route_id: z.string().min(1),
  trigger: z.string().min(1),
  mode: z.string().min(1),
  handler: z.string().min(1),
  entry_point: z.string().min(1),
  required_skills: z.array(z.string()),
  description: z.string().min(1),
});

export const RoutingConfigSchema = z.object({
  version: z.string(),
  schema: z.string(),
  routes: z.array(RouteSchema),
});

// ========================================
// TOPIC CATALOG SCHEMA
// ========================================

export const TopicSchema = z.object({
  topic_id: z.string().min(1),
  title: z.string().min(1),
  keywords: z.array(z.string()),
  is_critical: z.boolean(),
  coverage_threshold: z.number().int().min(0),
});

export const TopicCatalogSchema = z.object({
  version: z.string(),
  schema: z.string(),
  topics: z.array(TopicSchema),
  critical_flags: z.object({
    count: z.number().int(),
    ids: z.array(z.string()),
  }),
});

// ========================================
// POLICY BUNDLE SCHEMA
// ========================================

export const PolicySchema = z.object({
  policy_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  source: z.string().min(1),
  effective_date: z.string().min(1),
});

export const TriageSchema = z.object({
  scoring_rules: z.object({
    missing_critical_topic: z.number().int(),
    missing_non_critical_topic: z.number().int(),
    high_risk_keyword_multiplier: z.number().int(),
  }),
  routing_thresholds: z.object({
    fast: z.tuple([z.number().int(), z.number().int()]),
    crosscheck: z.tuple([z.number().int(), z.number().int()]),
    escalate: z.tuple([z.number().int(), z.number().int()]),
    human_gate: z.tuple([z.number().int(), z.number().int()]),
  }),
});

export const PolicyBundleSchema = z.object({
  version: z.string(),
  schema: z.string(),
  policies: z.array(PolicySchema),
  triage: TriageSchema,
  high_risk_keywords: z.array(z.string()),
  severity_mappings: z.record(z.string(), z.string()),
  fallback: z.object({
    unknown_severity: z.string(),
    missing_topic_coverage: z.string(),
    invalid_risk_score: z.number(),
  }),
});

// ========================================
// PROMPTS BUNDLE SCHEMA
// ========================================

export const PromptSchema = z.object({
  role: z.string(),
  instructions: z.string(),
  variables: z.record(z.any()),
  output_schema: z.any(),
});

export const PromptsBundleSchema = z.object({
  version: z.string(),
  schema: z.string(),
  prompts: z.record(z.string(), PromptSchema),
});

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Validate routing config
 */
export function validateRoutingConfig(data: unknown): z.infer<typeof RoutingConfigSchema> {
  try {
    return RoutingConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Schema] Routing validation failed:', error.errors);
      throw new Error(`Routing schema validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate topic catalog
 */
export function validateTopicCatalog(data: unknown): z.infer<typeof TopicCatalogSchema> {
  try {
    return TopicCatalogSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Schema] Topic catalog validation failed:', error.errors);
      throw new Error(`Topic catalog schema validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate policy bundle
 */
export function validatePolicyBundle(data: unknown): z.infer<typeof PolicyBundleSchema> {
  try {
    return PolicyBundleSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Schema] Policy bundle validation failed:', error.errors);
      throw new Error(`Policy bundle schema validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate prompts bundle (warn-only mode for LLM non-determinism)
 */
export function validatePromptsBundle(data: unknown): z.infer<typeof PromptsBundleSchema> {
  try {
    return PromptsBundleSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('[Schema] Prompts bundle validation warnings:', error.errors);
      // Return partial data even with errors (warn-only mode)
      return data as z.infer<typeof PromptsBundleSchema>;
    }
    throw error;
  }
}
