/**
 * Skills Framework - Bundle Loader
 *
 * Loads governance bundles from YAML/Markdown files.
 *
 * Phase 2: Runtime capability detection added, bundles DISABLED by default
 * Phase 3: Static import path (compile-time bundling) - RECOMMENDED
 * Alternative: Runtime fs.readFileSync (Node-only, not Edge-compatible)
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ========================================
// PHASE 2: CAPABILITY DETECTION
// ========================================

/**
 * Detect runtime environment capabilities
 * Phase 2: Detection logic added but NOT used in runtime
 */
export function detectRuntimeCapabilities(): {
  hasFileSystem: boolean;
  hasStaticImports: boolean;
  isEdgeRuntime: boolean;
} {
  // Check for Edge Runtime
  const isEdgeRuntime = (typeof globalThis !== 'undefined' && (globalThis as any).EdgeRuntime !== undefined) ||
                        process.env.NEXT_RUNTIME === 'edge';

  // Check for filesystem access
  const hasFileSystem = !isEdgeRuntime && typeof fs !== 'undefined';

  // Check for static imports (Phase 3 will implement this)
  const hasStaticImports = false; // Phase 3: Will check bundleImports.generated.ts

  return {
    hasFileSystem,
    hasStaticImports,
    isEdgeRuntime,
  };
}

/**
 * Get recommended loading strategy based on runtime
 * Phase 2: Strategy detection added but NOT used in runtime
 */
export function getLoadingStrategy(): 'static' | 'fs' | 'disabled' {
  const caps = detectRuntimeCapabilities();

  // Phase 2: Always return 'disabled' (no runtime changes)
  if (process.env.FLOW2_SKILL_REGISTRY !== 'true') {
    return 'disabled';
  }

  // Phase 3: Will enable strategy selection
  // if (caps.hasStaticImports) return 'static';
  // if (caps.hasFileSystem) return 'fs';
  // return 'disabled';

  // Phase 2: Use fs-based loading for validation only
  if (caps.hasFileSystem) return 'fs';
  return 'disabled';
}

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface Route {
  route_id: string;
  trigger: string;
  mode: string;
  handler: string;
  entry_point: string;
  required_skills: string[];
  description: string;
}

export interface RoutingConfig {
  version: string;
  schema: string;
  routes: Route[];
}

export interface Topic {
  topic_id: string;
  title: string;
  keywords: string[];
  is_critical: boolean;
  coverage_threshold: number;
}

export interface TopicCatalog {
  version: string;
  schema: string;
  topics: Topic[];
  critical_flags: {
    count: number;
    ids: string[];
  };
}

export interface Policy {
  policy_id: string;
  title: string;
  description: string;
  source: string;
  effective_date: string;
}

export interface PolicyBundle {
  version: string;
  schema: string;
  policies: Policy[];
  triage: {
    scoring_rules: {
      missing_critical_topic: number;
      missing_non_critical_topic: number;
      high_risk_keyword_multiplier: number;
    };
    routing_thresholds: {
      fast: [number, number];
      crosscheck: [number, number];
      escalate: [number, number];
      human_gate: [number, number];
    };
  };
  high_risk_keywords: string[];
  severity_mappings: Record<string, string>;
  fallback: {
    unknown_severity: string;
    missing_topic_coverage: string;
    invalid_risk_score: number;
  };
}

export interface PromptsBundle {
  version: string;
  schema: string;
  prompts: Record<string, {
    role: string;
    instructions: string;
    variables: Record<string, any>;
    output_schema: any;
  }>;
}

export interface LoadedBundles {
  routing: RoutingConfig;
  topicCatalog: TopicCatalog;
  policyBundle: PolicyBundle;
  promptsBundle: PromptsBundle;
  templates: {
    emailDefault: string;
    emailClarification: string;
    uiCopy?: string;
  };
}

// ========================================
// BUNDLE LOADING (Runtime fs read - Node only)
// ========================================

const BUNDLES_DIR = path.join(process.cwd(), 'app/lib/skills/flow2');
const TEMPLATES_DIR = path.join(BUNDLES_DIR, 'templates');

/**
 * Load all governance bundles
 *
 * Phase 2: Only called during validation (gates), NOT in runtime
 * Phase 3: Will use static imports when available
 *
 * Current: Uses runtime fs.readFileSync (Node-only approach)
 * Future: For Edge compatibility, use static import path instead
 */
export function loadAllBundles(): LoadedBundles {
  // Phase 2: Check loading strategy
  const strategy = getLoadingStrategy();

  if (strategy === 'disabled') {
    throw new Error('[BundleLoader] FLOW2_SKILL_REGISTRY not enabled, bundles not loaded');
  }

  // Phase 2: Only 'fs' strategy is implemented
  if (strategy !== 'fs') {
    throw new Error(`[BundleLoader] Strategy '${strategy}' not yet implemented (Phase 3)`);
  }

  try {
    // Load YAML bundles
    const routing = yaml.load(
      fs.readFileSync(path.join(BUNDLES_DIR, 'routing.yaml'), 'utf8')
    ) as RoutingConfig;

    const topicCatalog = yaml.load(
      fs.readFileSync(path.join(BUNDLES_DIR, 'topic_catalog.yaml'), 'utf8')
    ) as TopicCatalog;

    const policyBundle = yaml.load(
      fs.readFileSync(path.join(BUNDLES_DIR, 'policy_bundle.yaml'), 'utf8')
    ) as PolicyBundle;

    // Load Markdown prompts bundle (parse manually)
    const promptsMd = fs.readFileSync(path.join(BUNDLES_DIR, 'prompts_bundle.md'), 'utf8');
    const promptsBundle = parsePromptsMarkdown(promptsMd);

    // Load Handlebars templates
    const emailDefault = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'email_default.hbs'),
      'utf8'
    );

    const emailClarification = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'email_clarification.hbs'),
      'utf8'
    );

    // Load optional UI copy if exists
    let uiCopy: string | undefined;
    const uiCopyPath = path.join(TEMPLATES_DIR, 'ui_copy.md');
    if (fs.existsSync(uiCopyPath)) {
      uiCopy = fs.readFileSync(uiCopyPath, 'utf8');
    }

    console.log('[BundleLoader] ✓ All bundles loaded successfully');

    return {
      routing,
      topicCatalog,
      policyBundle,
      promptsBundle,
      templates: {
        emailDefault,
        emailClarification,
        uiCopy,
      },
    };
  } catch (error: any) {
    console.error('[BundleLoader] Failed to load bundles:', error.message);
    throw new Error(`Bundle loading failed: ${error.message}`);
  }
}

/**
 * Parse prompts_bundle.md into structured format
 *
 * Extracts prompt sections from Markdown
 */
function parsePromptsMarkdown(markdown: string): PromptsBundle {
  // Simple parser: extract prompt_id sections
  // In production, use a proper Markdown parser

  const prompts: Record<string, any> = {};

  // Extract topic_summaries prompt (hardcoded for Phase 3)
  if (markdown.includes('## prompt_id: topic_summaries')) {
    prompts.topic_summaries = {
      role: '{{prompt_role}}',
      instructions: '{{prompt_instructions}}',
      variables: {
        prompt_role: 'string',
        prompt_instructions: 'string',
        topic_count: 'integer',
        max_bullets: 'integer',
        max_evidence: 'integer',
        topics_list: 'string',
        documents_text: 'string',
      },
      output_schema: {
        type: 'array',
        items: {
          topic_id: 'string',
          coverage: 'string',
          bullets: 'array',
          evidence: 'array',
        },
      },
    };
  }

  return {
    version: '1.0',
    schema: 'prompts_bundle_v1',
    prompts,
  };
}

/**
 * Get specific bundle section by reference
 *
 * @param ref - Bundle reference in format "bundle:section" or "bundle:section.subsection"
 * @returns Bundle section data
 */
export function getBundleSection(ref: string, bundles: LoadedBundles): any {
  const [bundleName, sectionPath] = ref.split(':');

  if (!bundleName || !sectionPath) {
    throw new Error(`Invalid bundle reference format: ${ref}`);
  }

  switch (bundleName) {
    case 'topic_catalog':
      if (sectionPath === 'topics') return bundles.topicCatalog.topics;
      if (sectionPath === 'critical_flags') return bundles.topicCatalog.critical_flags;
      break;

    case 'policy_bundle':
      if (sectionPath === 'triage.scoring_rules') return bundles.policyBundle.triage.scoring_rules;
      if (sectionPath === 'triage.routing_thresholds') return bundles.policyBundle.triage.routing_thresholds;
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

  throw new Error(`Bundle section not found: ${ref}`);
}
