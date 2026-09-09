import { describe, it, expect } from "vitest";
import {
  resolveConfidence,
  gateViolation,
  effectiveCooldown,
  type GateRule,
} from "../../supabase/functions/_shared/alertGating";

const rule = (o: Partial<GateRule>): GateRule => ({
  id: "r1", name: "Rule", enabled: true, trigger_source: "ai_vision",
  confidence_threshold: 0.9, cooldown_seconds: 300, policy_id: null, policy_category: null, ...o,
});

describe("confidence resolution", () => {
  it("uses the violation's own confidence when present", () => {
    expect(resolveConfidence({ type: "no hard hat", confidence: 0.42 }, []).confidence).toBe(0.42);
  });

  it("matches a detection by label tokens", () => {
    const r = resolveConfidence({ type: "missing hard hat" }, [
      { label: "person without hard hat", confidence: 0.55 },
      { label: "forklift", confidence: 0.99 },
    ]);
    expect(r.confidence).toBe(0.55);
    expect(r.source).toBe("detection");
  });

  it("falls back to same-category detections", () => {
    const r = resolveConfidence({ type: "unsafe act", category: "ppe" }, [
      { label: "vest", category: "ppe", confidence: 0.6 },
    ]);
    expect(r.confidence).toBe(0.6);
    expect(r.source).toBe("category");
  });

  it("never silently assumes full confidence when nothing matches", () => {
    const r = resolveConfidence({ type: "unclear", severity: "low" }, [{ label: "box", confidence: 0.9 }]);
    expect(r.confidence).toBe(0.4);
    expect(r.source).toBe("severity");
  });
});

describe("gating", () => {
  it("drops detections below the camera threshold", () => {
    const d = gateViolation({ type: "no vest", confidence: 0.5 }, [], 0.75, []);
    expect(d.pass).toBe(false);
    expect(d.threshold).toBe(0.75);
  });

  it("passes detections at or above the camera threshold", () => {
    expect(gateViolation({ type: "no vest", confidence: 0.75 }, [], 0.75, []).pass).toBe(true);
  });

  it("applies a stricter site rule on top of the camera threshold", () => {
    const d = gateViolation({ type: "no vest", confidence: 0.8 }, [], 0.7, [rule({ confidence_threshold: 0.9 })]);
    expect(d.pass).toBe(false);
    expect(d.threshold).toBe(0.9);
    expect(d.rule_name).toBe("Rule");
  });

  it("never lets a lenient rule weaken the camera threshold", () => {
    const d = gateViolation({ type: "no vest", confidence: 0.6 }, [], 0.8, [rule({ confidence_threshold: 0.3 })]);
    expect(d.threshold).toBe(0.8);
    expect(d.pass).toBe(false);
  });

  it("ignores disabled and non-vision rules", () => {
    const d = gateViolation({ type: "no vest", confidence: 0.6 }, [], 0.5, [
      rule({ enabled: false }),
      rule({ id: "r2", trigger_source: "manual", confidence_threshold: 0.95 }),
    ]);
    expect(d.pass).toBe(true);
    expect(d.rule_id).toBeNull();
  });

  it("prefers a rule whose policy category matches the violation", () => {
    const d = gateViolation({ type: "ppe breach", confidence: 0.8 }, [], 0.5, [
      rule({ id: "generic", confidence_threshold: 0.6 }),
      rule({ id: "ppe", policy_id: "p1", policy_category: "ppe", confidence_threshold: 0.95 }),
    ]);
    expect(d.rule_id).toBe("ppe");
    expect(d.pass).toBe(false);
  });
});

describe("cooldown", () => {
  it("takes the longest configured cooldown", () => {
    expect(effectiveCooldown([rule({ cooldown_seconds: 900 })], 300)).toBe(900);
    expect(effectiveCooldown([], 300)).toBe(300);
    expect(effectiveCooldown([rule({ cooldown_seconds: 60 })], 300)).toBe(300);
  });
});
