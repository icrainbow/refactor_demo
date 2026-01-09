/**
 * Shadow-Run Logger (Phase 3.2)
 *
 * Logs comparison results between legacy and bundle implementations.
 * Used only when FLOW2_SHADOW_RUN=true for validation.
 *
 * Safety:
 * - No external dependencies
 * - Dev: console.warn/error for visibility
 * - Prod: console.warn only, no throw, no PII
 * - Always includes run_id if available for traceability
 *
 * Phase 3.3.1: Added rate limiting and explicit PII redaction
 */

// Phase 3.3.1: Rate limiting - max 1 log per 30s per key
const RATE_LIMIT_MS = 30000; // 30 seconds
const lastLogTime: Map<string, number> = new Map();

function shouldLog(logKey: string): boolean {
  const now = Date.now();
  const lastTime = lastLogTime.get(logKey);

  if (!lastTime || now - lastTime >= RATE_LIMIT_MS) {
    lastLogTime.set(logKey, now);
    return true;
  }

  return false;
}

// Phase 3.3.1: PII fields to redact (case-insensitive)
const PII_FIELDS = new Set([
  'content',
  'text',
  'document',
  'email',
  'name',
  'address',
  'id',
  'passport',
  'snippet',
  'summary',
  'reasons',
  'description',
]);

function redactPII(obj: any): any {
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactPII);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (PII_FIELDS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactPII(value);
    }
  }
  return redacted;
}

export interface ShadowRunContext {
  component: string; // e.g., 'riskTriage', 'highRiskKeywords'
  run_id?: string;
  timestamp?: string;
}

export interface StableFieldDiff {
  field: string;
  legacy: any;
  bundle: any;
}

/**
 * Log successful match between legacy and bundle stable fields
 * Dev: console.log for debugging, Prod: silent (only log mismatches)
 *
 * Phase 3.3.1: Added rate limiting
 */
export function logMatch(
  context: ShadowRunContext,
  legacyStable: Record<string, any>,
  bundleStable: Record<string, any>
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const logKey = `MATCH:${context.component}`;

  // Phase 3.3.1: Rate limiting
  if (!shouldLog(logKey)) {
    return;
  }

  if (!isProd) {
    console.log(
      `[ShadowRun:MATCH] ${context.component}${context.run_id ? ` (run=${context.run_id})` : ''}`,
      {
        legacy: legacyStable,
        bundle: bundleStable,
      }
    );
  }
  // Prod: silent on matches to reduce log noise
}

/**
 * Log mismatch between legacy and bundle stable fields
 * Dev: console.warn with full diff
 * Prod: console.warn with sanitized diff (no PII)
 *
 * Phase 3.3.1: Added rate limiting and explicit PII redaction
 */
export function logMismatch(
  context: ShadowRunContext,
  diffs: StableFieldDiff[]
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const logKey = `MISMATCH:${context.component}`;

  // Phase 3.3.1: Rate limiting
  if (!shouldLog(logKey)) {
    return;
  }

  if (isProd) {
    // Prod: sanitized warning only
    console.warn(
      `[ShadowRun:MISMATCH] ${context.component}${context.run_id ? ` (run=${context.run_id})` : ''}`,
      {
        fieldCount: diffs.length,
        fields: diffs.map(d => d.field),
        // Do NOT log full values in prod (may contain PII)
      }
    );
  } else {
    // Dev: PII-redacted diff for debugging
    const redactedDiffs = diffs.map(diff => ({
      field: diff.field,
      legacy: redactPII(diff.legacy),
      bundle: redactPII(diff.bundle),
    }));

    console.warn(
      `[ShadowRun:MISMATCH] ${context.component}${context.run_id ? ` (run=${context.run_id})` : ''}`,
      {
        diffs: redactedDiffs,
      }
    );
  }
}

/**
 * Log error during bundle computation
 * Dev: console.error with stack trace
 * Prod: console.warn with sanitized message only
 *
 * Phase 3.3.1: Added rate limiting
 */
export function logError(
  context: ShadowRunContext,
  whichSide: 'legacy' | 'bundle',
  error: Error
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const logKey = `ERROR:${context.component}:${whichSide}`;

  // Phase 3.3.1: Rate limiting
  if (!shouldLog(logKey)) {
    return;
  }

  if (isProd) {
    // Prod: sanitized warning, no stack trace
    console.warn(
      `[ShadowRun:ERROR] ${context.component} ${whichSide} failed${context.run_id ? ` (run=${context.run_id})` : ''}`,
      {
        message: error.message,
        // Do NOT log stack trace in prod
      }
    );
  } else {
    // Dev: full error with stack
    console.error(
      `[ShadowRun:ERROR] ${context.component} ${whichSide} failed${context.run_id ? ` (run=${context.run_id})` : ''}`,
      {
        error,
        stack: error.stack,
      }
    );
  }
}

/**
 * Compare two stable field objects and return diffs
 * Helper for identifying mismatches
 */
export function compareStableFields(
  legacy: Record<string, any>,
  bundle: Record<string, any>
): StableFieldDiff[] {
  const diffs: StableFieldDiff[] = [];
  const allFieldsSet = new Set([...Object.keys(legacy), ...Object.keys(bundle)]);
  const allFields = Array.from(allFieldsSet);

  for (const field of allFields) {
    const legacyValue = legacy[field];
    const bundleValue = bundle[field];

    // Deep comparison for arrays/objects
    if (!deepEqual(legacyValue, bundleValue)) {
      diffs.push({
        field,
        legacy: legacyValue,
        bundle: bundleValue,
      });
    }
  }

  return diffs;
}

/**
 * Deep equality check (simple implementation for deterministic data)
 * Handles primitives, arrays, and plain objects
 */
function deepEqual(a: any, b: any): boolean {
  // Same reference
  if (a === b) return true;

  // Null/undefined
  if (a == null || b == null) return a === b;

  // Different types
  if (typeof a !== typeof b) return false;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  // Primitives
  return a === b;
}
