# Agent Runtime - Skill Execution Engine

**Phase 5.2**: Deterministic skill execution engine for agent workflows.

## Overview

The runtime engine executes agent flows by sequentially processing steps and calling skill handlers. All execution is **deterministic** - no LLM calls, no randomness, no side effects (except logging).

## Architecture

```
ExecutePlanInput → executeAgentPlan() → ExecutePlanResult
                         ↓
                   Load agent by ID
                   Validate routeId
                   Execute steps sequentially
                         ↓
                   Call skill handlers
                   Merge outputs
                   Handle human gates
                         ↓
                   Return result with outputs
```

## Files

- **types.ts**: Type definitions for execution contracts
- **skillRegistry.ts**: In-memory registry of skill handlers
- **engine.ts**: Main execution logic (`executeAgentPlan`)

## How to Add a New Skill Handler

1. **Define handler function** in `skillRegistry.ts`:
   ```typescript
   const mySkillHandler: SkillHandler = async (input, ctx) => {
     // Deterministic logic here (no LLM, no randomness)
     return {
       result: 'value',
       // ... other outputs
     };
   };
   ```

2. **Register in SKILLS object**:
   ```typescript
   export const SKILLS: SkillRegistry = {
     // ... existing skills
     my_skill_ref: mySkillHandler,
   };
   ```

3. **Use in agent flow** (in `registry.ts`):
   ```typescript
   steps: [
     { id: 'my_step', kind: 'skill', ref: 'my_skill_ref' },
   ]
   ```

## Skill Handler Contract

All skill handlers must follow this signature:

```typescript
type SkillHandler = (input: SkillInput, ctx: SkillContext) => Promise<SkillOutput>;

// Where:
interface SkillContext {
  routeId: string;  // Current route (e.g., 'kyc_review')
  agentId: string;  // Current agent (e.g., 'kyc_agent')
  runId: string;    // Unique run identifier
}

type SkillInput = Record<string, unknown>;   // Input from previous steps
type SkillOutput = Record<string, unknown>;  // Output for next steps
```

## Step Execution Rules

1. **skill** and **tool** steps:
   - Call the handler specified by `step.ref`
   - Pass accumulated input from previous steps
   - Merge output into current input for next step
   - If step is `optional: true`, catch errors and continue

2. **human** steps:
   - Skip execution (no handler called)
   - Record `{ skipped: true }` in outputs
   - Continue to next step

3. **Error handling**:
   - Optional steps: record error, continue
   - Required steps: stop execution, return `ok: false`

## Step.ref Mapping

The `step.ref` field maps to skill handler keys in `SKILLS`:

| step.ref | Handler | Purpose |
|----------|---------|---------|
| `topic_summaries` | topicSummariesHandler | Extract topic IDs from catalog |
| `risk_triage` | riskTriageHandler | Assess risk level (low/medium/high) |
| `process_recommendation` | processRecommendationHandler | Route recommendation |
| `guardrail_check` | guardrailCheckHandler | Validate guardrails |
| `guardrail_detector` | guardrailDetectorHandler | Detect guardrail alerts |
| `cs_integration` | csIntegrationHandler | Case2 CS system check |
| `impact_analysis` | impactAnalysisHandler | IT impact assessment |
| `validation` | validationHandler | Cross-system validation |
| `chat_skill` | chatSkillHandler | Chat response generation |

## Determinism Guarantee

All skill handlers in this engine are **deterministic**:
- Same input + same context → same output
- No LLM API calls
- No random number generation
- No current timestamp in logic (only in metadata)
- No external API calls (except reading local config)

This ensures:
- Reproducible test results
- Predictable behavior
- Fast execution (no network latency)

## Example Usage

```typescript
import { executeAgentPlan } from './engine';

const result = await executeAgentPlan({
  agentId: 'kyc_agent',
  routeId: 'kyc_review',
  runId: 'run-12345',
  initial: { query: 'Review KYC documents' },
});

if (result.ok) {
  console.log('Execution succeeded');
  console.log('Topic IDs:', result.outputs.topic_summaries.topic_ids);
  console.log('Risk:', result.outputs.risk_triage.risk);
} else {
  console.error('Execution failed:', result.outputs.error);
}
```

## Testing

See `tests/unit/agentEngine.test.ts` for execution tests.
See `tests/unit/skillRegistry.test.ts` for skill handler tests.
