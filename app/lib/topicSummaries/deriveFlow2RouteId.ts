/**
 * Phase 3.5 Batch 1: RouteId Derivation Helper
 *
 * Deterministic helper to derive Flow2 routeId from runtime context.
 * Replaces hard-coded routeId strings at call sites with derived values.
 *
 * Priority order (explicit → implicit):
 * 1. guardrail_check (case3Active)
 * 2. it_review (case4Active)
 * 3. case2_review (case2Active)
 * 4. kyc_review (isFlow2)
 * 5. chat_general (fallback)
 *
 * Safety:
 * - Never throws
 * - No side effects (no logging, no DOM, no I/O)
 * - Pure function (deterministic)
 * - Testable with boolean primitives
 */

import type { Flow2RouteId } from './topicSetResolver';

/**
 * Context for deriving Flow2 routeId
 * All fields are existing boolean flags from document/page.tsx
 */
export type DeriveContext = {
  isFlow2: boolean;      // Flow mode === "2"
  case3Active: boolean;  // Guardrail check active
  case4Active: boolean;  // IT review active
  case2Active: boolean;  // Case2 CS Integration active
};

/**
 * Derive Flow2 routeId from runtime context
 *
 * @param ctx - Derivation context with existing boolean flags
 * @returns Flow2 routeId matching current mode
 */
export function deriveFlow2RouteId(ctx: DeriveContext): Flow2RouteId {
  // Priority 1: Guardrail check (blocks other flows)
  if (ctx.case3Active) return 'guardrail_check';

  // Priority 2: IT review (explicit mode selection)
  if (ctx.case4Active) return 'it_review';

  // Priority 3: Case2 review (explicit CS Integration)
  if (ctx.case2Active) return 'case2_review';

  // Priority 4: KYC review (default Flow2 mode)
  if (ctx.isFlow2) return 'kyc_review';

  // Priority 5: Chat general (fallback)
  return 'chat_general';
}
