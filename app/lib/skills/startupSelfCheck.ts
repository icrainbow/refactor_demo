/**
 * Skills Framework - Startup Self-Check
 *
 * 5 validation functions to ensure bundle integrity before runtime
 * Dev: fail-fast | Prod: warn + fallback to legacy
 */

import fs from 'fs';
import path from 'path';
import type { LoadedBundles, RoutingConfig, TopicCatalog, PolicyBundle } from './bundleLoader';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface SelfCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Function 1: Check Required Skills Existence
 *
 * Validates all required_skills references in routing.yaml
 */
export function checkRequiredSkillsExist(
  routing: RoutingConfig,
  bundles: LoadedBundles
): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const route of routing.routes) {
    for (const skillRef of route.required_skills) {
      // Parse format: "bundle:section" or "app/path/to/file.ts"
      if (skillRef.includes(':')) {
        // Bundle reference
        const [bundleName, sectionKey] = skillRef.split(':');

        // Check bundle exists
        if (!['topic_catalog', 'policy_bundle', 'prompts_bundle', 'templates'].includes(bundleName)) {
          errors.push(`[${route.route_id}] Unknown bundle: ${bundleName}`);
          continue;
        }

        // Check section exists
        try {
          getBundleSectionForValidation(skillRef, bundles);
        } catch (err: any) {
          errors.push(`[${route.route_id}] Section not found: ${skillRef} - ${err.message}`);
        }
      } else {
        // File reference - check file exists
        const filePath = path.join(process.cwd(), skillRef);
        if (!fs.existsSync(filePath)) {
          errors.push(`[${route.route_id}] File not found: ${skillRef}`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Function 2: Validate Bundle Schemas
 *
 * Validates structure of all loaded bundles
 */
export function validateBundleSchemas(bundles: LoadedBundles): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate routing.yaml
  if (!bundles.routing.version || !bundles.routing.schema) {
    errors.push('[routing.yaml] Missing version or schema');
  }
  if (!Array.isArray(bundles.routing.routes) || bundles.routing.routes.length === 0) {
    errors.push('[routing.yaml] No routes defined');
  }

  for (const route of bundles.routing.routes) {
    if (!route.route_id || !route.trigger || !route.mode || !route.handler) {
      errors.push(`[routing.yaml] Incomplete route definition: ${route.route_id || 'unknown'}`);
    }
  }

  // Validate topic_catalog.yaml
  if (!Array.isArray(bundles.topicCatalog.topics) || bundles.topicCatalog.topics.length === 0) {
    errors.push('[topic_catalog.yaml] No topics defined');
  }

  for (const topic of bundles.topicCatalog.topics) {
    if (!topic.topic_id || !topic.title || !Array.isArray(topic.keywords)) {
      errors.push(`[topic_catalog.yaml] Incomplete topic: ${topic.topic_id || 'unknown'}`);
    }
  }

  // Validate policy_bundle.yaml
  if (!Array.isArray(bundles.policyBundle.policies) || bundles.policyBundle.policies.length === 0) {
    errors.push('[policy_bundle.yaml] No policies defined');
  }

  if (!bundles.policyBundle.triage || !bundles.policyBundle.triage.scoring_rules) {
    errors.push('[policy_bundle.yaml] Missing triage rules');
  }

  // Validate prompts_bundle (warn-only for LLM non-determinism)
  if (!bundles.promptsBundle.prompts || Object.keys(bundles.promptsBundle.prompts).length === 0) {
    warnings.push('[prompts_bundle.md] No prompts defined (warn-only)');
  }

  // Validate templates
  if (!bundles.templates.emailDefault || bundles.templates.emailDefault.trim().length === 0) {
    errors.push('[templates/email_default.hbs] Empty template');
  }

  if (!bundles.templates.emailClarification || bundles.templates.emailClarification.trim().length === 0) {
    errors.push('[templates/email_clarification.hbs] Empty template');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Function 3: Detect Orphan Sections
 *
 * Finds bundle sections never referenced by any route
 */
export function detectOrphanSections(
  routing: RoutingConfig,
  bundles: LoadedBundles
): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect all referenced sections
  const referencedSections = new Set<string>();
  for (const route of routing.routes) {
    for (const skillRef of route.required_skills) {
      if (skillRef.includes(':')) {
        referencedSections.add(skillRef);
      }
    }
  }

  // Check all bundle sections
  const allSections = [
    'topic_catalog:topics',
    'topic_catalog:critical_flags',
    'policy_bundle:triage.scoring_rules',
    'policy_bundle:triage.routing_thresholds',
    'policy_bundle:high_risk_keywords',
    'policy_bundle:severity_mappings',
    'policy_bundle:policies',
    'prompts_bundle:topic_summaries',
    'templates:email_default',
    'templates:email_clarification',
  ];

  for (const section of allSections) {
    if (!referencedSections.has(section)) {
      warnings.push(`Orphan section (never referenced): ${section}`);
    }
  }

  return {
    ok: true, // Orphans are warnings, not errors
    errors,
    warnings,
  };
}

/**
 * Function 4: Detect Duplicates and Conflicts
 *
 * Checks for duplicate IDs and conflicting configurations
 */
export function detectConflicts(bundles: LoadedBundles): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check duplicate route_id
  const routeIds = new Set<string>();
  for (const route of bundles.routing.routes) {
    if (routeIds.has(route.route_id)) {
      errors.push(`Duplicate route_id: ${route.route_id}`);
    }
    routeIds.add(route.route_id);
  }

  // Check duplicate topic_id
  const topicIds = new Set<string>();
  for (const topic of bundles.topicCatalog.topics) {
    if (topicIds.has(topic.topic_id)) {
      errors.push(`Duplicate topic_id: ${topic.topic_id}`);
    }
    topicIds.add(topic.topic_id);
  }

  // Check duplicate policy_id
  const policyIds = new Set<string>();
  for (const policy of bundles.policyBundle.policies) {
    if (policyIds.has(policy.policy_id)) {
      errors.push(`Duplicate policy_id: ${policy.policy_id}`);
    }
    policyIds.add(policy.policy_id);
  }

  // Check routing threshold conflicts (overlapping ranges)
  const thresholds = bundles.policyBundle.triage.routing_thresholds;
  if (thresholds.fast[1] >= thresholds.crosscheck[0]) {
    errors.push(`Threshold conflict: fast[1]=${thresholds.fast[1]} overlaps crosscheck[0]=${thresholds.crosscheck[0]}`);
  }
  if (thresholds.crosscheck[1] >= thresholds.escalate[0]) {
    errors.push(`Threshold conflict: crosscheck[1]=${thresholds.crosscheck[1]} overlaps escalate[0]=${thresholds.escalate[0]}`);
  }
  if (thresholds.escalate[1] >= thresholds.human_gate[0]) {
    errors.push(`Threshold conflict: escalate[1]=${thresholds.escalate[1]} overlaps human_gate[0]=${thresholds.human_gate[0]}`);
  }

  // Check duplicate high-risk keywords
  const keywords = new Set<string>();
  for (const keyword of bundles.policyBundle.high_risk_keywords) {
    if (keywords.has(keyword.toLowerCase())) {
      warnings.push(`Duplicate high-risk keyword: ${keyword}`);
    }
    keywords.add(keyword.toLowerCase());
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Function 5: Check Template Variable Completeness
 *
 * Validates all required Handlebars variables present in templates
 */
export function checkTemplateVariables(templates: LoadedBundles['templates']): SelfCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables for email_default.hbs
  const requiredEmailDefault = [
    'run_id',
    'paused_at',
    'document_count',
    'approve_url',
    'reject_url',
    'message_id',
    'token_hint',
  ];

  // Optional variables (includes conditional/iteration block contexts)
  const optionalEmailDefault = [
    'issues',
    'topic_summaries',
    'elapsed_minutes',
    'documents',     // Used in {{#each documents}} block
    'is_reminder',   // Used in {{#if is_reminder}} conditional
  ];

  // Required variables for email_clarification.hbs
  const requiredEddEmail = [
    'run_id',
    'approve_url',
    'reject_url',
    'message_id',
    'token_hint',
  ];

  // Optional variables for email_clarification.hbs
  const optionalEddEmail = [
    'edd_findings',  // Used in {{#if edd_findings}} conditional
  ];

  // Extract variables from template (simple regex: {{var}})
  const extractVars = (template: string): Set<string> => {
    const regex = /\{\{([^}#/]+)\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.startsWith('#') && !varName.startsWith('/')) {
        vars.add(varName);
      }
    }
    return vars;
  };

  // Check email_default.hbs
  const emailDefaultVars = extractVars(templates.emailDefault);
  for (const reqVar of requiredEmailDefault) {
    if (!emailDefaultVars.has(reqVar)) {
      errors.push(`[email_default.hbs] Missing required variable: {{${reqVar}}}`);
    }
  }

  for (const optVar of optionalEmailDefault) {
    if (!emailDefaultVars.has(optVar)) {
      warnings.push(`[email_default.hbs] Missing optional variable: {{${optVar}}}`);
    }
  }

  // Check email_clarification.hbs
  const emailEddVars = extractVars(templates.emailClarification);
  for (const reqVar of requiredEddEmail) {
    if (!emailEddVars.has(reqVar)) {
      errors.push(`[email_clarification.hbs] Missing required variable: {{${reqVar}}}`);
    }
  }

  for (const optVar of optionalEddEmail) {
    if (!emailEddVars.has(optVar)) {
      warnings.push(`[email_clarification.hbs] Missing optional variable: {{${optVar}}}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// ========================================
// MASTER SELF-CHECK
// ========================================

/**
 * Run all 5 validation functions
 *
 * @param mode - 'dev' (fail-fast) or 'prod' (warn + fallback)
 * @param bundles - Loaded bundles to validate
 */
export function runStartupSelfCheck(mode: 'dev' | 'prod', bundles: LoadedBundles): SelfCheckResult {
  const results = [
    checkRequiredSkillsExist(bundles.routing, bundles),
    validateBundleSchemas(bundles),
    detectOrphanSections(bundles.routing, bundles),
    detectConflicts(bundles),
    checkTemplateVariables(bundles.templates),
  ];

  const allErrors = results.flatMap((r) => r.errors);
  const allWarnings = results.flatMap((r) => r.warnings);

  if (mode === 'dev') {
    // Dev: Fail-fast on any error
    if (allErrors.length > 0) {
      console.error('[SelfCheck/Dev] FAILED:\n' + allErrors.join('\n'));
      throw new Error(`Self-check failed: ${allErrors.length} error(s)`);
    }
    if (allWarnings.length > 0) {
      console.warn('[SelfCheck/Dev] Warnings:\n' + allWarnings.join('\n'));
    }
  } else if (mode === 'prod') {
    // Prod: Log errors, send alert, return for fallback
    if (allErrors.length > 0) {
      console.error('[SelfCheck/Prod] CRITICAL errors:', allErrors);
      // TODO: Send alert to monitoring (Sentry, CloudWatch, etc.)
      // sendAlert('Self-check validation failed in production', { errors: allErrors });
    }
    if (allWarnings.length > 0) {
      console.warn('[SelfCheck/Prod] Warnings:', allWarnings);
    }
  }

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function getBundleSectionForValidation(ref: string, bundles: LoadedBundles): any {
  const [bundleName, sectionPath] = ref.split(':');

  switch (bundleName) {
    case 'topic_catalog':
      if (sectionPath === 'topics') return bundles.topicCatalog.topics;
      if (sectionPath === 'critical_flags') return bundles.topicCatalog.critical_flags;
      break;

    case 'policy_bundle':
      if (sectionPath === 'triage.scoring_rules') return bundles.policyBundle.triage.scoring_rules;
      if (sectionPath === 'triage.routing_thresholds')
        return bundles.policyBundle.triage.routing_thresholds;
      if (sectionPath === 'high_risk_keywords') return bundles.policyBundle.high_risk_keywords;
      if (sectionPath === 'severity_mappings') return bundles.policyBundle.severity_mappings;
      if (sectionPath === 'policies') return bundles.policyBundle.policies;
      break;

    case 'prompts_bundle':
      if (sectionPath === 'topic_summaries') return bundles.promptsBundle.prompts.topic_summaries;
      break;

    case 'templates':
      if (sectionPath === 'email_default') return bundles.templates.emailDefault;
      if (sectionPath === 'email_clarification') return bundles.templates.emailClarification;
      if (sectionPath === 'ui_copy') return bundles.templates.uiCopy;
      break;

    default:
      throw new Error(`Unknown bundle: ${bundleName}`);
  }

  throw new Error(`Section not found: ${ref}`);
}
