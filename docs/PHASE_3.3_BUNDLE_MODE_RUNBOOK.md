# Phase 3.3 Bundle Mode Runbook

## Overview

Phase 3.3 introduces **controlled cutover** between legacy and bundle implementations via a single environment variable: `FLOW2_BUNDLE_MODE`.

This decouples "bundle readable" (controlled by `FLOW2_SKILL_REGISTRY`) from "bundle returned" (controlled by `FLOW2_BUNDLE_MODE`).

## Bundle Mode Configuration

### Environment Variable: FLOW2_BUNDLE_MODE

**Default:** `legacy` (when unset or invalid)

**Allowed Values:**
- `legacy` - Compute and return legacy only (DEFAULT, production-safe)
- `shadow` - Compute both legacy and bundle, compare stable fields, return legacy (validation)
- `active` - Compute and return bundle, with error fallback to legacy (controlled cutover)

### Mode Table

| Mode     | Compute Legacy | Compute Bundle | Return Value | Comparison | Use Case                          |
|----------|----------------|----------------|--------------|------------|-----------------------------------|
| `legacy` | ✅             | ❌             | Legacy       | None       | Default production behavior       |
| `shadow` | ✅             | ✅             | Legacy       | Yes (log)  | Validation, find mismatches       |
| `active` | ✅ (optional)  | ✅             | **Bundle**   | Yes (log)  | Controlled cutover, staging first |

## How to Enable Each Mode

### Legacy Mode (Default)

```bash
# Option 1: Unset (default)
unset FLOW2_BUNDLE_MODE

# Option 2: Explicit
export FLOW2_BUNDLE_MODE=legacy

# Run application
npm run dev
# OR
npm start
```

**Expected Behavior:**
- Only legacy code path executes
- No bundle loading attempted
- Zero overhead
- Production-safe

### Shadow Mode (Validation)

```bash
# Enable shadow mode
export FLOW2_BUNDLE_MODE=shadow

# Optional: Ensure bundles are loadable (for fs-based)
export FLOW2_SKILL_REGISTRY=true

# Run application
npm run dev
# OR run tests
npm run gate:all
```

**Expected Behavior:**
- Both legacy and bundle paths execute in parallel
- Stable fields compared and logged
- **Legacy result always returned** (users see no change)
- Higher CPU usage (2x computation)
- Logs show `[ShadowRun:MATCH]` or `[ShadowRun:MISMATCH]`

**Expected Logs:**
```
[ShadowRun:MATCH] riskTriage
[ShadowRun:MATCH] highRiskKeywords

# OR if mismatches found:
[ShadowRun:MISMATCH] riskTriage { diffs: [...] }
```

### Active Mode (Controlled Cutover)

```bash
# Enable active mode
export FLOW2_BUNDLE_MODE=active

# Ensure bundles are loadable
export FLOW2_SKILL_REGISTRY=true

# Run application (staging recommended first)
npm start
```

**Expected Behavior:**
- Bundle path executes and **result is returned to users**
- Legacy path optionally executed for comparison logging
- If bundle computation fails: automatic fallback to legacy (prod-safe)
- Users see bundle-computed results (may differ from legacy)

**Expected Logs:**
```
# Success:
[riskTriage:active] Returning bundle result

# Fallback on error:
[ShadowRun:ERROR] riskTriage bundle failed
[riskTriage:active] Bundle failed, falling back to legacy
```

**⚠️ IMPORTANT:** Active mode changes user-facing behavior. Run in staging first.

## Rollback Commands

### Instant Rollback (< 1 minute)

```bash
# Option 1: Set to legacy mode
export FLOW2_BUNDLE_MODE=legacy

# Option 2: Unset (defaults to legacy)
unset FLOW2_BUNDLE_MODE

# Restart application
pm2 restart app
# OR
kill <pid> && npm start
```

### Additional Safety (if needed)

```bash
# Also disable bundle loading
export FLOW2_SKILL_REGISTRY=false

# Legacy FLOW2_SHADOW_RUN flag (Phase 3.2 compatibility)
unset FLOW2_SHADOW_RUN
```

### Code Rollback (emergency)

```bash
# Revert Phase 3.3 changes
git revert <phase-3.3-commit-hash>

# OR manual file restoration
git checkout HEAD~1 -- app/lib/graphKyc/riskTriage.ts
git checkout HEAD~1 -- app/lib/graphKyc/topicAssembler.ts
rm app/lib/skills/flow2/bundleMode.ts
```

## Staging Rollout Checklist

**Phase 1: Shadow Mode Validation (1-2 days)**

1. Enable shadow mode in staging:
   ```bash
   export FLOW2_BUNDLE_MODE=shadow
   export FLOW2_SKILL_REGISTRY=true
   ```

2. Monitor logs for mismatches:
   ```bash
   # Filter shadow-run logs
   tail -f /var/log/app.log | grep "ShadowRun"
   ```

3. Acceptance criteria:
   - [ ] No unexpected mismatches in stable fields
   - [ ] No bundle load errors
   - [ ] CPU/latency within acceptable range (2x expected)
   - [ ] At least 1000 requests processed successfully

4. If mismatches found:
   - [ ] Analyze diff reports
   - [ ] Update bundle YAML files if needed
   - [ ] Re-run shadow mode validation
   - [ ] Do NOT proceed to active mode until clean

**Phase 2: Active Mode Staging (3-5 days)**

1. Enable active mode in staging:
   ```bash
   export FLOW2_BUNDLE_MODE=active
   export FLOW2_SKILL_REGISTRY=true
   ```

2. Verify bundle results:
   - [ ] Triage results (routePath, riskScore) match expectations
   - [ ] High-risk keyword detection working correctly
   - [ ] No unexpected fallbacks to legacy

3. A/B comparison (if possible):
   - [ ] Run same test cases in legacy and active modes
   - [ ] Compare stable field outputs
   - [ ] Document intentional differences (if any)

4. Load testing:
   - [ ] Verify latency acceptable (should be ~same as legacy, no 2x)
   - [ ] No memory leaks
   - [ ] Error rate < 0.1%

**Phase 3: Production Rollout (gradual)**

**⚠️ DO NOT enable active mode in production without:**
1. Successful shadow mode validation
2. Successful active mode staging validation
3. Explicit approval from Tech Lead + Product Owner
4. Monitoring dashboards ready
5. Rollback plan communicated to team

**Gradual Rollout Strategy:**
```bash
# Option A: Canary (1% traffic)
# Use routing/load balancer to direct 1% to active mode instance

# Option B: Feature flag (per-account)
# Add logic to check account_id and enable active mode selectively

# Option C: Time-based (off-hours first)
# Enable active mode during low-traffic hours
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rate:**
   - Metric: `app.bundle.error_rate`
   - Threshold: < 0.1%
   - Alert: > 1% for 5 minutes

2. **Fallback Rate (Active Mode):**
   - Metric: `app.bundle.fallback_rate`
   - Threshold: < 0.5%
   - Alert: > 5% for 5 minutes

3. **Mismatch Rate (Shadow/Active):**
   - Metric: `app.bundle.mismatch_rate`
   - Threshold: Depends on expectations
   - Alert: > 10% sudden increase

4. **Latency (P95):**
   - Metric: `app.response_time.p95`
   - Threshold: < 500ms
   - Alert: > 1000ms for 5 minutes

### Log Queries

**Filter Shadow-Run Matches/Mismatches:**
```bash
# All shadow-run logs
grep "ShadowRun" /var/log/app.log

# Mismatches only
grep "ShadowRun:MISMATCH" /var/log/app.log

# Errors only
grep "ShadowRun:ERROR" /var/log/app.log
```

**Filter Active Mode Fallbacks:**
```bash
grep "fallback to legacy" /var/log/app.log
```

## Troubleshooting

### Problem: Mismatches in Shadow Mode

**Symptoms:**
- `[ShadowRun:MISMATCH]` logs frequently
- Stable fields differ between legacy and bundle

**Diagnosis:**
```bash
# Check specific field mismatches
grep "ShadowRun:MISMATCH" /var/log/app.log | grep "routePath"

# Verify bundle YAML configuration
cat app/lib/skills/flow2/policy_bundle.yaml
cat app/lib/skills/flow2/topic_catalog.yaml
```

**Resolution:**
1. **If bundle is incorrect:** Update YAML files to match legacy behavior
2. **If legacy is incorrect:** Document as intentional improvement, proceed with baseline update
3. **If both valid:** Document as expected difference, update golden tests if needed

### Problem: Bundle Load Errors

**Symptoms:**
- `[BundleAccessors] Load failed`
- `[ShadowRun:ERROR] bundle failed`

**Diagnosis:**
```bash
# Check bundle file existence
ls -la app/lib/skills/flow2/*.yaml

# Check fs access (scripts vs runtime)
node -e "console.log(require('fs').existsSync('./app/lib/skills/flow2/policy_bundle.yaml'))"
```

**Resolution:**
1. **Missing files:** Ensure YAML files exist in correct location
2. **Edge runtime (Vercel/Cloudflare):** Run `npm run generate:bundle-imports` (Phase 3.4)
3. **Permission issues:** Check file permissions

### Problem: High CPU Usage in Shadow Mode

**Expected:** Shadow mode doubles computation cost (runs both paths)

**Resolution:**
- Shadow mode is NOT for production traffic
- Use shadow mode only in dev/staging for validation
- Once validated, move to active mode (no 2x overhead)

### Problem: Fallbacks in Active Mode

**Symptoms:**
- `[riskTriage:active] Bundle failed, falling back to legacy`
- Higher than expected fallback rate

**Diagnosis:**
```bash
# Check error messages
grep "Bundle failed" /var/log/app.log | tail -20

# Check bundle validation
npm run gate:selfcheck
```

**Resolution:**
1. **Bundle validation errors:** Fix YAML syntax/schema issues
2. **Runtime errors:** Check bundle accessor logic
3. **Transient errors:** Monitor retry logic, may be acceptable < 0.5%

## Relationship to Other Flags

### FLOW2_SKILL_REGISTRY (Phase 3.1)

**Purpose:** Controls whether bundles can be loaded ("bundle readable")

**Relationship to FLOW2_BUNDLE_MODE:**
- `FLOW2_SKILL_REGISTRY` = "can we load bundles?"
- `FLOW2_BUNDLE_MODE` = "which result do we return?"

**Examples:**
```bash
# Legacy mode (no bundle loading needed)
FLOW2_BUNDLE_MODE=legacy
FLOW2_SKILL_REGISTRY=false  # Optional, bundles not loaded anyway

# Shadow mode (requires bundle loading)
FLOW2_BUNDLE_MODE=shadow
FLOW2_SKILL_REGISTRY=true  # Required for fs-based loading

# Active mode (requires bundle loading)
FLOW2_BUNDLE_MODE=active
FLOW2_SKILL_REGISTRY=true  # Required
```

### FLOW2_SHADOW_RUN (Phase 3.2, DEPRECATED)

**Status:** Superseded by `FLOW2_BUNDLE_MODE=shadow`

**Migration:**
```bash
# Old (Phase 3.2)
export FLOW2_SHADOW_RUN=true

# New (Phase 3.3)
export FLOW2_BUNDLE_MODE=shadow
```

**Backward Compatibility:** Phase 3.3 code ignores `FLOW2_SHADOW_RUN` and only reads `FLOW2_BUNDLE_MODE`.

## Next Steps (Phase 3.4+)

After successful active mode validation:

1. **Phase 3.4:** Topic catalog 7→8 integration (deferred from Phase 3.1)
2. **Phase 3.5:** Email templates integration
3. **Phase 3.6:** Prompts bundle integration
4. **Phase 4:** Deprecate legacy constants (after full production validation)

---

**Document Version:** Phase 3.3
**Last Updated:** 2026-01-08
**Owner:** Engineering
