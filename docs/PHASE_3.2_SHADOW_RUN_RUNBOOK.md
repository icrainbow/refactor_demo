# Phase 3.2 Shadow-Run Runbook

## Overview

Shadow-run mode allows validation of bundle implementations against legacy code by running both paths in parallel and comparing deterministic stable fields only. The legacy result is always returned to users - shadow-run is purely for validation logging.

## Feature Flags

### FLOW2_SHADOW_RUN
**Default:** `false`
**Purpose:** Enable parallel execution of legacy + bundle paths for comparison
**Scope:** Dev/staging only (NOT for production traffic)

### FLOW2_SKILL_REGISTRY
**Default:** `false`
**Purpose:** Master kill switch for bundle loading
**Note:** Shadow-run can force bundle loading even when this is false (for testing)

## How to Enable Shadow-Run

### Development/Local Testing

```bash
# Enable shadow-run (compares legacy vs bundle, returns legacy)
export FLOW2_SHADOW_RUN=true

# Run application or tests
npm run dev
# OR
npm run gate:all
```

### Staging Environment

```bash
# Set environment variable in deployment config
FLOW2_SHADOW_RUN=true npm start
```

**⚠️ IMPORTANT:** Shadow-run doubles computation (runs both paths), so expect:
- 2x CPU usage
- 2x latency (parallel execution, but still slower)
- Additional log volume

## What Gets Compared

### Integrated Components (Phase 3.2)

1. **Risk Triage** (`app/lib/graphKyc/riskTriage.ts`)
   - **Stable Fields:**
     - `routePath` (fast/crosscheck/escalate/human_gate)
     - `riskScore` (numeric, deterministic)
     - `coveragePoints` (breakdown)
     - `keywordPoints` (breakdown)
   - **Excluded:**
     - `triageReasons` (free text, document-specific)

2. **High-Risk Keywords** (`app/lib/graphKyc/topicAssembler.ts`)
   - **Stable Fields:**
     - `hitCount` (number of keywords matched)
     - `matchedKeywords` (sorted, de-duplicated array)
   - **Excluded:**
     - Content text
     - Keyword positions

### NOT Compared (Non-Deterministic)
- LLM-generated text
- Natural language summaries
- Timestamps
- run_id/message_id
- Evidence snippets
- Document content

## Expected Logs

### Match (No Differences)

```
[ShadowRun:MATCH] riskTriage (run=abc123)
{
  legacy: { routePath: 'fast', riskScore: 20, coveragePoints: 15, keywordPoints: 5 },
  bundle: { routePath: 'fast', riskScore: 20, coveragePoints: 15, keywordPoints: 5 }
}
```

### Mismatch (Differences Found)

**Development:**
```
[ShadowRun:MISMATCH] highRiskKeywords (run=abc123)
{
  diffs: [
    {
      field: 'hitCount',
      legacy: 3,
      bundle: 4
    },
    {
      field: 'matchedKeywords',
      legacy: ['pep', 'sanctions', 'offshore'],
      bundle: ['pep', 'sanctions', 'offshore', 'cryptocurrency']
    }
  ]
}
```

**Production:**
```
[ShadowRun:MISMATCH] highRiskKeywords (run=abc123)
{
  fieldCount: 2,
  fields: ['hitCount', 'matchedKeywords']
  // No values logged (PII safety)
}
```

### Error (Bundle Path Failed)

**Development:**
```
[ShadowRun:ERROR] riskTriage bundle failed (run=abc123)
{
  error: Error,
  stack: '...'
}
```

**Production:**
```
[ShadowRun:ERROR] riskTriage bundle failed (run=abc123)
{
  message: 'Bundle load failed'
  // No stack trace (sanitized)
}
```

## Kill Switches

### Immediate Disable (< 1 minute)

```bash
# Option 1: Unset flag (requires restart)
unset FLOW2_SHADOW_RUN
# OR
export FLOW2_SHADOW_RUN=false

# Restart application
pm2 restart app
# OR kill and restart process
```

### Rollback Code (if needed)

```bash
# Revert to Phase 3.1 (pre-shadow-run)
git revert <phase-3.2-commit-hash>

# OR manual file restoration
git checkout HEAD~1 -- app/lib/graphKyc/riskTriage.ts
git checkout HEAD~1 -- app/lib/graphKyc/topicAssembler.ts
git checkout HEAD~1 -- app/lib/skills/flow2/bundleAccessors.ts
git checkout HEAD~1 -- app/lib/skills/shadowRun.ts
rm app/lib/skills/shadowRunLogger.ts
```

## Testing Shadow-Run

### Verify No Behavior Change

```bash
# 1. Default (legacy only, no shadow-run)
npm run gate:all
# Expected: All gates PASS

# 2. Shadow-run enabled (still returns legacy)
FLOW2_SHADOW_RUN=true npm run gate:all
# Expected: All gates PASS, shadow-run logs in console

# 3. Shadow-run + registry disabled (forces bundle load for comparison)
FLOW2_SHADOW_RUN=true FLOW2_SKILL_REGISTRY=false npm run gate:all
# Expected: All gates PASS, bundle loaded for comparison only
```

### Verify Logs in Dev Server

```bash
# Start dev server with shadow-run
FLOW2_SHADOW_RUN=true npm run dev

# Trigger a KYC review workflow
# - Upload documents
# - Click "Run Process Review"
# - Check console for [ShadowRun:MATCH] or [ShadowRun:MISMATCH] logs
```

## Troubleshooting

### No Logs Appearing

**Cause:** Shadow-run flag not set or check failed
**Solution:**
```bash
# Verify flag is set
echo $FLOW2_SHADOW_RUN
# Should output: true

# Check runtime code reaches shadow-run block
# Add temporary log before if statement in riskTriage.ts:
console.log('[DEBUG] FLOW2_SHADOW_RUN=', process.env.FLOW2_SHADOW_RUN);
```

### Bundle Load Errors

**Cause:** Bundles not generated or fs access blocked
**Solution:**
```bash
# Generate static imports (Phase 3 future work)
npm run generate:bundle-imports

# OR ensure fs-based loading works in scripts
# Check bundleStaticLoader.ts script detection logic
```

### Mismatches Every Time

**Cause:** Bundle config differs from legacy constants
**Solution:**
1. Review bundle YAML files for accuracy
2. Compare scoring rules, thresholds, keywords
3. Update bundles to match legacy if needed:
   - `app/lib/skills/flow2/policy_bundle.yaml`
   - `app/lib/skills/flow2/topic_catalog.yaml`

## Production Safety

### ⚠️ NOT FOR PRODUCTION
Shadow-run mode is **NOT recommended for production traffic** due to:
- 2x computational cost
- Increased latency
- Log volume (may expose PII if misconfigured)

### If Accidentally Enabled in Production
1. **Immediate:** Set `FLOW2_SHADOW_RUN=false` and restart
2. **Review Logs:** Check for accidental PII exposure in mismatch logs
3. **Monitor:** Verify CPU/latency returns to normal

### Production-Safe Alternative
For production validation:
1. Use Phase 3.1 bundle integration with `FLOW2_SKILL_REGISTRY=true`
2. Monitor deterministic outputs via golden regression tests
3. Run shadow-run in staging with production traffic replay

## Next Steps (Phase 3.3+)

After validating shadow-run results:
1. **Phase 3.3:** Gradually enable `FLOW2_SKILL_REGISTRY=true` in staging
2. **Phase 3.3:** Monitor bundle path outputs (still return legacy)
3. **Phase 3.4:** Traffic cutover - return bundle results (controlled rollout)
4. **Phase 3.5:** Deprecate legacy constants (after full validation)

---

**Document Version:** Phase 3.2
**Last Updated:** 2026-01-08
**Owner:** Engineering
