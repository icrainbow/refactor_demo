# Phase 3.4 Rollout Guide

**Version:** 1.0
**Date:** 2026-01-09
**Status:** Ready for Production Rollout
**Tag:** `phase-3.4-complete`

## Overview

Phase 3.4 introduces topic catalog YAML bundles with safe, opt-in cutover from legacy hardcoded topic sets to YAML-defined configurations. The implementation includes comprehensive validation, shadow-mode testing, and graceful fallback mechanisms.

## Key Features

- **YAML Topic Catalog**: Centralized topic definitions in `app/lib/skills/flow2/topic_catalog.yaml`
- **Safe Validation**: Automatic validation with dev fail-fast and prod graceful degradation
- **Three Operating Modes**: Legacy (default), Shadow (validation), Active (production)
- **Zero UI Impact**: Topic IDs and ordering remain stable
- **Instant Rollback**: Single environment variable change

## Operating Modes

### 1. Legacy Mode (DEFAULT)

**Status:** Always safe, requires no configuration

```bash
# No environment variables needed
# OR explicitly set:
export FLOW2_BUNDLE_MODE=legacy
# OR unset:
unset FLOW2_BUNDLE_MODE
unset FLOW2_SKILL_REGISTRY
```

**Behavior:**
- Uses hardcoded legacy topic sets only
- No bundle loading attempted
- No validation overhead
- 100% backward compatible

**When to use:**
- Default for all environments initially
- Instant rollback from shadow/active modes
- When bundle loading is unreliable

### 2. Shadow Mode (VALIDATION)

**Status:** Safe for testing, returns legacy data

```bash
export FLOW2_BUNDLE_MODE=shadow
export FLOW2_SKILL_REGISTRY=true
```

**Behavior:**
- Loads and validates YAML bundles
- Compares bundle vs legacy results
- **Always returns legacy data** (no user impact)
- Logs comparison differences with `[FLOW2][TOPIC_CATALOG][SHADOW]` prefix
- Detects mismatches between YAML and hardcoded values

**When to use:**
- Dev/test environments before production rollout
- Validating YAML changes before active mode
- Debugging discrepancies between legacy and bundle

**What to monitor:**
```bash
# Watch for shadow comparison logs
grep "[FLOW2][TOPIC_CATALOG][SHADOW]" logs/app.log

# Expected: No mismatch logs if YAML matches legacy
# If mismatches appear: Investigate YAML vs legacy differences
```

### 3. Active Mode (PRODUCTION)

**Status:** Production-ready with fallback

```bash
export FLOW2_BUNDLE_MODE=active
export FLOW2_SKILL_REGISTRY=true
```

**Behavior:**
- Loads and validates YAML bundles
- **Returns bundle data** when validation succeeds
- Falls back to legacy on validation failure
- Logs fallback with `[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK]` prefix

**When to use:**
- Production after successful shadow validation
- When YAML is the source of truth

**What to monitor:**
```bash
# Watch for validation failures
grep "[FLOW2][TOPIC_CATALOG][VALIDATION]" logs/app.log

# Watch for active fallbacks
grep "[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK]" logs/app.log

# Expected in prod: No validation errors, no fallbacks
# If fallbacks occur: Check YAML integrity, review validation errors
```

## Validation Behavior

### Development Mode (`NODE_ENV !== 'production'`)

**Fail-Fast Strategy:**
- Invalid YAML → Application throws error on startup
- Prevents deployment with broken configuration
- Forces immediate fix during development

### Production Mode (`NODE_ENV === 'production'`)

**Graceful Degradation:**
- Invalid YAML → Logs warning + falls back to legacy
- Application continues running (no downtime)
- Operators alerted via logs, can fix during maintenance window

### Validation Rules

The validator checks:

1. **Required Structure**
   - `topic_sets` field must exist and be an object
   - Each route's topic set must be an array of strings

2. **Data Integrity**
   - No duplicate topic IDs within a topic set (ERROR)
   - All referenced topic IDs should exist in catalog (WARNING)

3. **Naming Conventions**
   - Route names should use underscores, not spaces/hyphens (WARNING)
   - Unknown route IDs trigger suggestions (WARNING)

4. **Safe Behavior**
   - Never throws in production
   - Warnings don't block operation
   - Errors in dev mode prevent bad deploys

## Recommended Rollout Sequence

### Phase 1: Shadow Validation (Week 1)

**Environments:** Dev → Test

```bash
# 1. Enable shadow mode in dev
export FLOW2_BUNDLE_MODE=shadow
export FLOW2_SKILL_REGISTRY=true

# 2. Run application + execute test scenarios
npm run dev

# 3. Monitor logs for shadow mismatches
grep "[FLOW2][TOPIC_CATALOG][SHADOW]" logs/dev.log

# 4. Expected: No mismatches (YAML matches legacy)
# If mismatches: Document differences, update YAML if needed

# 5. Repeat in test environment
# 6. Validate golden tests still pass
npm run gate:golden
```

**Success Criteria:**
- [ ] No shadow mismatch logs for 24+ hours
- [ ] All golden tests passing (5/5)
- [ ] All unit tests passing (114/114)
- [ ] No validation errors in logs

### Phase 2: Active in Dev (Week 2)

**Environment:** Dev only

```bash
# 1. Switch to active mode in dev
export FLOW2_BUNDLE_MODE=active
export FLOW2_SKILL_REGISTRY=true

# 2. Run application + execute test scenarios
npm run dev

# 3. Monitor for fallbacks
grep "[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK]" logs/dev.log

# 4. Expected: No fallbacks (bundle used successfully)
# If fallbacks: Review validation errors, fix YAML
```

**Success Criteria:**
- [ ] No ACTIVE_FALLBACK logs for 48+ hours
- [ ] All topics displaying correctly in UI
- [ ] Document page topic summaries working
- [ ] No user-reported issues

### Phase 3: Active in Staging (Week 3)

**Environment:** Staging

```bash
# 1. Deploy to staging with active mode
export FLOW2_BUNDLE_MODE=active
export FLOW2_SKILL_REGISTRY=true
export NODE_ENV=production  # Use prod validation mode

# 2. Run full regression suite
npm run test:e2e

# 3. Manual smoke tests
# - KYC review flow (8 topics)
# - Case2 review flow (6 topics)
# - IT review flow (5 topics)

# 4. Monitor for 72 hours
grep "[FLOW2][TOPIC_CATALOG]" logs/staging.log
```

**Success Criteria:**
- [ ] No validation failures
- [ ] No fallbacks to legacy
- [ ] All E2E tests passing
- [ ] Performance metrics unchanged
- [ ] No increase in error rates

### Phase 4: Active in Production (Week 4+)

**Environment:** Production

```bash
# 1. Deploy to production with active mode
export FLOW2_BUNDLE_MODE=active
export FLOW2_SKILL_REGISTRY=true
export NODE_ENV=production

# 2. Gradual rollout (if using feature flags)
# - Start with 10% traffic
# - Monitor for 24 hours
# - Increase to 50% → 100%

# 3. Monitor continuously
watch -n 60 'grep "[FLOW2][TOPIC_CATALOG]" logs/prod.log | tail -20'
```

**Success Criteria:**
- [ ] No validation failures for 7+ days
- [ ] No fallbacks to legacy for 7+ days
- [ ] User experience unchanged
- [ ] Performance metrics stable
- [ ] Error rates unchanged

## Instant Rollback

### From Shadow Mode

```bash
# Return to legacy (no impact, already using legacy data)
unset FLOW2_BUNDLE_MODE
unset FLOW2_SKILL_REGISTRY
# OR
export FLOW2_BUNDLE_MODE=legacy
```

**Impact:** None (shadow mode already returns legacy data)

### From Active Mode

```bash
# Emergency rollback to legacy
export FLOW2_BUNDLE_MODE=legacy
# OR
unset FLOW2_BUNDLE_MODE
unset FLOW2_SKILL_REGISTRY

# Restart application (if needed)
pm2 restart app
# OR
systemctl restart app-service
```

**Impact:** Immediate switch to hardcoded topic sets
**Downtime:** None (graceful switch)
**Data loss:** None (topic IDs unchanged)

## Verification Commands

### Check Current Mode

```bash
# In Node.js runtime
node -e "console.log('MODE:', process.env.FLOW2_BUNDLE_MODE || 'legacy')"
node -e "console.log('REGISTRY:', process.env.FLOW2_SKILL_REGISTRY || 'false')"
```

### Validate YAML Syntax

```bash
# Manual validation
npx js-yaml app/lib/skills/flow2/topic_catalog.yaml

# Programmatic validation (runs on startup)
# Check logs for:
grep "Topic catalog validation" logs/app.log
```

### Test Bundle Loading

```bash
# Run self-check script
npm run gate:selfcheck

# Run golden regression tests
npm run gate:golden

# Expected output:
# ✓ Bundles loaded successfully
# ✓ Golden Regression PASSED - All tests passed (5/5)
```

### Monitor Runtime Logs

```bash
# Key log prefixes to watch:
grep "\[FLOW2\]\[TOPIC_CATALOG\]" logs/app.log

# Validation logs:
# [FLOW2][TOPIC_CATALOG][VALIDATION] Validation passed/failed
# [FLOW2][TOPIC_CATALOG][VALIDATION] Warnings: ...

# Shadow mode logs:
# [FLOW2][TOPIC_CATALOG][SHADOW] MISMATCH: ...

# Active mode fallback logs:
# [FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK] Falling back to legacy because: ...
```

## Known Safe Invariants

**These remain stable across all modes:**

1. **Topic IDs:** Unchanged between legacy and bundle
2. **Topic Ordering:** Preserved from YAML
3. **Critical Flags:** `is_critical` field maintained
4. **Coverage Thresholds:** Token count thresholds stable
5. **UI Behavior:** No visual changes to topic summaries panel
6. **API Responses:** Same shape, same data (in active mode)

**User Experience:**
- No visible changes in document page
- Topic summaries appear identical
- Highlight/coverage behavior unchanged
- Evidence panel functionality identical

## Troubleshooting

### Issue: Validation Fails in Dev

**Symptoms:**
```
Error: Topic catalog validation failed: Missing required field: topic_sets
```

**Solution:**
```bash
# 1. Check YAML syntax
npx js-yaml app/lib/skills/flow2/topic_catalog.yaml

# 2. Verify topic_sets exists and is object
grep -A 5 "topic_sets:" app/lib/skills/flow2/topic_catalog.yaml

# 3. Run unit tests
npx vitest run tests/unit/topicCatalogValidator.test.ts

# 4. Check git status (file might be corrupted)
git status app/lib/skills/flow2/topic_catalog.yaml
```

### Issue: Active Fallback Logs in Production

**Symptoms:**
```
[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK] Falling back to legacy because: ...
```

**Solution:**
```bash
# 1. Check validation error details
grep "[FLOW2][TOPIC_CATALOG][VALIDATION]" logs/prod.log | tail -20

# 2. Verify YAML file deployed correctly
md5sum app/lib/skills/flow2/topic_catalog.yaml

# 3. Compare with source control
git diff HEAD -- app/lib/skills/flow2/topic_catalog.yaml

# 4. If YAML corrupted, rollback immediately
export FLOW2_BUNDLE_MODE=legacy
systemctl restart app-service

# 5. Fix YAML in next maintenance window
```

### Issue: Shadow Mismatch Logs

**Symptoms:**
```
[FLOW2][TOPIC_CATALOG][SHADOW] MISMATCH: kyc_review topics differ
```

**Solution:**
```bash
# This is expected if YAML intentionally differs from legacy
# 1. Review mismatch details in logs
# 2. Confirm YAML changes are intentional
# 3. Update legacy constants if YAML is source of truth
# 4. OR update YAML if legacy is correct

# Not an error - shadow mode always returns legacy
# Just informational for validation
```

### Issue: Bundles Not Loading

**Symptoms:**
```
[BundleAccessors] FAILED: [BundleLoader] Bundles disabled - use legacy constants
```

**Solution:**
```bash
# Check FLOW2_SKILL_REGISTRY is set
echo $FLOW2_SKILL_REGISTRY
# Expected: "true"

# If not set:
export FLOW2_SKILL_REGISTRY=true

# Restart application
```

## Configuration Reference

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `FLOW2_BUNDLE_MODE` | `legacy`, `shadow`, `active` | `legacy` | Controls which mode is active |
| `FLOW2_SKILL_REGISTRY` | `true`, `false` | `false` | Master kill switch for bundles |
| `FLOW2_BUNDLE_COMPARE` | `true`, `false` | `false` | Enable legacy comparison in active mode |
| `NODE_ENV` | `production`, `development`, `test` | - | Controls validation strictness |

### Files Modified in Phase 3.4

| File | Purpose |
|------|---------|
| `app/lib/skills/flow2/topic_catalog.yaml` | YAML topic catalog (source of truth) |
| `app/lib/skills/flow2/topicCatalogValidator.ts` | Validation logic (pure, deterministic) |
| `app/lib/skills/flow2/bundleAccessors.ts` | Bundle loading with validation wiring |
| `app/lib/topicSummaries/topicSetResolver.ts` | Resolver with mode-aware logic |
| `tests/unit/topicCatalogValidator.test.ts` | Validator unit tests (36 cases) |
| `tests/unit/topicSetResolver.test.ts` | Resolver tests with shadow/active |

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `validateFlow2TopicCatalog()` | `topicCatalogValidator.ts` | Validates YAML structure |
| `getFlow2BundleMode()` | `bundleMode.ts` | Returns current mode |
| `resolveTopicSet()` | `topicSetResolver.ts` | Resolves topic set for route |
| `loadAndCacheBundles()` | `bundleAccessors.ts` | Loads + validates bundles |

## Support & Escalation

### Monitoring Alerts

Set up alerts for:

1. **Validation Failures** (prod)
   - Trigger: `[FLOW2][TOPIC_CATALOG][VALIDATION]` + "failed"
   - Severity: Warning
   - Action: Review YAML integrity within 1 hour

2. **Active Fallbacks** (prod)
   - Trigger: `[FLOW2][TOPIC_CATALOG][ACTIVE_FALLBACK]`
   - Severity: Warning
   - Action: Investigate within 2 hours, rollback if persistent

3. **Bundle Load Errors** (prod)
   - Trigger: `[BundleAccessors] FAILED`
   - Severity: Info (expected if SKILL_REGISTRY=false)
   - Action: Verify env var configuration

### Emergency Contacts

- **Phase 3.4 Owner:** [Team/Email]
- **On-Call Engineer:** [Rotation/Email]
- **Escalation Path:** [Manager/Email]

## Appendix: Test Results

### Unit Tests (Phase 3.4 Batch 5)

```
✓ tests/unit/topicCatalogValidator.test.ts  (36 tests) - PASS
✓ tests/unit/topicSetResolver.test.ts       (13 tests) - PASS
✓ tests/unit/bundleMode.test.ts             (22 tests) - PASS
✓ tests/unit/graphUtils.test.ts             (9 tests)  - PASS
✓ tests/unit/flow2InputMode.test.ts         (4 tests)  - PASS
✓ tests/unit/ambiguousRejectDetector.test.ts (30 tests) - PASS

Total: 114/114 PASS
```

### Golden Regression Tests

```
✓ Test 1: Case 2 Review - Chat Triggered          - PASS
✓ Test 2: Chat General - Knowledge Base Query     - PASS
✓ Test 3: Guardrail Check - Pre-Review Validation - PASS
✓ Test 4: IT Review - Bulletin Analysis           - PASS
✓ Test 5: KYC Review - Standard Case              - PASS

Total: 5/5 PASS
```

### Lint & Typecheck

```
✓ TypeScript compilation: PASS (0 errors)
✓ ESLint: PASS (only pre-existing warnings)
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Next Review:** After production rollout completion
