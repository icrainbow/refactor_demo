/**
 * Agent Execution API (Phase 5.2)
 *
 * POST /api/agents/run
 * Executes an agent flow based on context-derived route.
 *
 * Body: { ctx: DeriveContext-like fields, initial?: object }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildDeriveContext } from '@/app/lib/topicSummaries/buildDeriveContext';
import { deriveFlow2RouteId } from '@/app/lib/topicSummaries/deriveFlow2RouteId';
import { resolveAgentByRouteId } from '@/app/agents/registry';
import { executeAgentPlan } from '@/app/agents/runtime/engine';

interface RunAgentRequestBody {
  ctx?: {
    isFlow2: boolean;
    case2Active: boolean;
    case3Active: boolean;
    case4Active: boolean;
  };
  // Alternative: direct flags (for convenience)
  isFlow2?: boolean;
  case2Active?: boolean;
  case3Active?: boolean;
  case4Active?: boolean;
  // Initial input for agent
  initial?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RunAgentRequestBody;

    // Build context (prefer ctx object, fallback to direct flags)
    const ctxInput = body.ctx || {
      isFlow2: body.isFlow2 ?? false,
      case2Active: body.case2Active ?? false,
      case3Active: body.case3Active ?? false,
      case4Active: body.case4Active ?? false,
    };

    const deriveCtx = buildDeriveContext(ctxInput);

    // Derive routeId from context
    const routeId = deriveFlow2RouteId(deriveCtx);

    // Resolve agent by routeId
    const agent = resolveAgentByRouteId(routeId);

    // Generate runId (use crypto.randomUUID if available, fallback to timestamp)
    const runId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `run-${Date.now()}`;

    // Execute agent plan
    const result = await executeAgentPlan({
      agentId: agent.id,
      routeId,
      runId,
      initial: body.initial || {},
    });

    // Return result
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
