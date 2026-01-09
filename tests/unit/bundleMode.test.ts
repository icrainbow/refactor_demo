import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Phase 3.3.1: Bundle Mode Parser Tests
 *
 * Tests for getFlow2BundleMode() function and guardrails
 */

// We need to test the actual bundleMode module, but since it reads from process.env,
// we'll need to manipulate env vars and re-import the module
describe('Bundle Mode Parser', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars before each test
    delete process.env.FLOW2_BUNDLE_MODE;
    delete process.env.FLOW2_SKILL_REGISTRY;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('Default behavior', () => {
    it('should default to legacy when FLOW2_BUNDLE_MODE is unset', async () => {
      // Import fresh module
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should default to legacy when FLOW2_BUNDLE_MODE is empty string', async () => {
      process.env.FLOW2_BUNDLE_MODE = '';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });
  });

  describe('Valid mode values', () => {
    it('should return "legacy" when FLOW2_BUNDLE_MODE=legacy', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'legacy';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should return "shadow" when FLOW2_BUNDLE_MODE=shadow and SKILL_REGISTRY=true', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'shadow';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('shadow');
    });

    it('should return "active" when FLOW2_BUNDLE_MODE=active and SKILL_REGISTRY=true', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'active';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('active');
    });

    it('should handle case-insensitive values (SHADOW → shadow)', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'SHADOW';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('shadow');
    });

    it('should handle whitespace trimming', async () => {
      process.env.FLOW2_BUNDLE_MODE = '  active  ';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('active');
    });
  });

  describe('Invalid mode values', () => {
    it('should default to legacy for invalid mode value', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'invalid';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should default to legacy for numeric mode value', async () => {
      process.env.FLOW2_BUNDLE_MODE = '123';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should default to legacy for boolean mode value', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'true';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });
  });

  describe('Phase 3.3.1: Guardrail - mode + registry compatibility', () => {
    it('should force legacy when shadow requested but SKILL_REGISTRY=false', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'shadow';
      process.env.FLOW2_SKILL_REGISTRY = 'false';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should force legacy when active requested but SKILL_REGISTRY=false', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'active';
      process.env.FLOW2_SKILL_REGISTRY = 'false';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should force legacy when shadow requested but SKILL_REGISTRY unset', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'shadow';
      delete process.env.FLOW2_SKILL_REGISTRY;
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should force legacy when active requested but SKILL_REGISTRY unset', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'active';
      delete process.env.FLOW2_SKILL_REGISTRY;
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });

    it('should NOT force legacy when legacy explicitly set with SKILL_REGISTRY=false', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'legacy';
      process.env.FLOW2_SKILL_REGISTRY = 'false';
      const { getFlow2BundleMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(getFlow2BundleMode()).toBe('legacy');
    });
  });

  describe('Helper functions', () => {
    it('isShadowMode should return true only when mode is shadow', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'shadow';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { isShadowMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(isShadowMode()).toBe(true);
    });

    it('isActiveMode should return true only when mode is active', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'active';
      process.env.FLOW2_SKILL_REGISTRY = 'true';
      const { isActiveMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(isActiveMode()).toBe(true);
    });

    it('isLegacyMode should return true only when mode is legacy', async () => {
      process.env.FLOW2_BUNDLE_MODE = 'legacy';
      const { isLegacyMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(isLegacyMode()).toBe(true);
    });

    it('isLegacyMode should return true for default (unset)', async () => {
      delete process.env.FLOW2_BUNDLE_MODE;
      const { isLegacyMode } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(isLegacyMode()).toBe(true);
    });
  });

  describe('Phase 3.3.1: FLOW2_BUNDLE_COMPARE flag', () => {
    it('shouldCompareLegacyInActive should return false by default', async () => {
      delete process.env.FLOW2_BUNDLE_COMPARE;
      const { shouldCompareLegacyInActive } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(shouldCompareLegacyInActive()).toBe(false);
    });

    it('shouldCompareLegacyInActive should return true when FLOW2_BUNDLE_COMPARE=true', async () => {
      process.env.FLOW2_BUNDLE_COMPARE = 'true';
      const { shouldCompareLegacyInActive } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(shouldCompareLegacyInActive()).toBe(true);
    });

    it('shouldCompareLegacyInActive should return false when FLOW2_BUNDLE_COMPARE=false', async () => {
      process.env.FLOW2_BUNDLE_COMPARE = 'false';
      const { shouldCompareLegacyInActive } = await import('../../app/lib/skills/flow2/bundleMode');
      expect(shouldCompareLegacyInActive()).toBe(false);
    });
  });
});
