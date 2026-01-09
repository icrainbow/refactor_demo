/**
 * Phase 4: Minimal Topic Set Resolver
 *
 * Pure deterministic resolver for route-specific topic sets.
 * Reads from bundled topic_catalog.yaml only.
 */

import fs from 'fs';
import path from 'path';

/**
 * Route identifier for topic set resolution
 */
export type Flow2RouteId =
  | 'kyc_review'
  | 'case2_review'
  | 'it_review'
  | 'guardrail_check'
  | 'chat_general'
  | string;

/**
 * Resolved topic set with metadata
 */
export interface TopicSet {
  /** List of topic IDs for this route */
  topic_ids: string[];
  /** Optional title mappings (if available from catalog) */
  titles?: Record<string, string>;
}

/**
 * Topic catalog structure from YAML
 */
interface TopicCatalog {
  topics?: Array<{ topic_id: string; title: string }>;
  topic_sets?: Record<string, string[]>;
}

// Cache the loaded catalog
let cachedCatalog: TopicCatalog | null = null;

/**
 * Simple YAML parser for topic catalog (minimal implementation)
 * Only handles the specific structure we need: topics array and topic_sets map
 */
function parseSimpleYAML(content: string): TopicCatalog {
  const catalog: TopicCatalog = {
    topics: [],
    topic_sets: {},
  };

  const lines = content.split('\n');
  let inTopicSets = false;
  let currentRouteId = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect topic_sets section
    if (line.trim() === 'topic_sets:') {
      inTopicSets = true;
      continue;
    }

    if (inTopicSets) {
      // Route ID line (e.g., "  kyc_review:")
      const routeMatch = line.match(/^  ([a-z0-9_]+):\s*$/);
      if (routeMatch) {
        currentRouteId = routeMatch[1];
        catalog.topic_sets![currentRouteId] = [];
        continue;
      }
      // Topic ID line (e.g., "    - customer_identity_profile")
      const topicMatch = line.match(/^    - ([a-z0-9_]+)\s*$/);
      if (topicMatch && currentRouteId) {
        const topicId = topicMatch[1];
        catalog.topic_sets![currentRouteId].push(topicId);
      }
    } else {
      // Parse topics section for titles (optional)
      if (line.match(/^  - topic_id: /)) {
        const topicId = line.split('topic_id: ')[1].trim();
        let title = '';

        // Look ahead for title
        if (i + 1 < lines.length && lines[i + 1].includes('title:')) {
          title = lines[i + 1].split('title:')[1].trim().replace(/['"]/g, '');
        }

        catalog.topics!.push({ topic_id: topicId, title });
      }
    }
  }

  return catalog;
}

/**
 * Load topic catalog from bundled YAML file
 */
function loadTopicCatalog(): TopicCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const catalogPath = path.join(
    process.cwd(),
    'app/lib/skills/flow2/topic_catalog.yaml'
  );

  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Topic catalog not found at: ${catalogPath}`);
  }

  const content = fs.readFileSync(catalogPath, 'utf-8');
  cachedCatalog = parseSimpleYAML(content);

  if (!cachedCatalog) {
    throw new Error('Failed to parse topic catalog YAML');
  }

  return cachedCatalog;
}

/**
 * Resolve topic set for a given route
 *
 * @param routeId - Route identifier (kyc_review, case2_review, it_review, etc.)
 * @returns TopicSet with topic_ids and optional titles
 * @throws Error if routeId not found in catalog
 */
export function resolveTopicSet(routeId: Flow2RouteId): TopicSet {
  const catalog = loadTopicCatalog();

  if (!catalog.topic_sets) {
    throw new Error('No topic_sets found in catalog');
  }

  const topicIds = catalog.topic_sets[routeId];
  if (!topicIds || !Array.isArray(topicIds)) {
    throw new Error(`No topic set found for route: ${routeId}`);
  }

  // Extract titles from catalog if available
  const titles: Record<string, string> = {};
  if (catalog.topics && Array.isArray(catalog.topics)) {
    for (const topic of catalog.topics) {
      if (topic.topic_id && topic.title) {
        titles[topic.topic_id] = topic.title;
      }
    }
  }

  return {
    topic_ids: topicIds,
    titles: Object.keys(titles).length > 0 ? titles : undefined,
  };
}

/**
 * Get all available route IDs from catalog
 */
export function getAvailableRoutes(): Flow2RouteId[] {
  const catalog = loadTopicCatalog();
  return Object.keys(catalog.topic_sets || {});
}
