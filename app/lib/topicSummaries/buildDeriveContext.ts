/**
 * buildDeriveContext: Single source of truth for constructing DeriveContext
 *
 * Phase 3.7: Consolidates live context construction to prevent drift across handlers.
 * Pure function with no side effects.
 */

import type { DeriveContext } from './deriveFlow2RouteId';

/**
 * Build a DeriveContext from live application state
 *
 * @param args - Live boolean state flags from React component
 * @returns DeriveContext ready for deriveFlow2RouteId()
 */
export function buildDeriveContext(args: {
  isFlow2: boolean;
  case3Active: boolean;
  case4Active: boolean;
  case2Active: boolean;
}): DeriveContext {
  return {
    isFlow2: args.isFlow2,
    case3Active: args.case3Active,
    case4Active: args.case4Active,
    case2Active: args.case2Active,
  };
}
