import { describe, it, expect } from "vitest";
import { detectionsToBoxes } from "@/hooks/useVisionOverlay";

const one = (d: any) => detectionsToBoxes({ detections: [d] })[0];

describe("overlay boxes", () => {
  const near = (b: any) => {
    expect(b.x).toBeCloseTo(0.1); expect(b.y).toBeCloseTo(0.2);
    expect(b.w).toBeCloseTo(0.3); expect(b.h).toBeCloseTo(0.4);
  };
  it("normalised xywh", () => near(one({ label: "a", bbox: [0.1, 0.2, 0.3, 0.4] })));
  it("percent", () => near(one({ label: "a", bbox: [10, 20, 30, 40] })));
  it("gemini box_2d ymin,xmin,ymax,xmax /1000", () => {
    const b = one({ label: "a", box_2d: [200, 100, 600, 400] });
    expect(b.x).toBeCloseTo(0.1); expect(b.y).toBeCloseTo(0.2);
    expect(b.w).toBeCloseTo(0.3); expect(b.h).toBeCloseTo(0.4);
  });
  it("corner object", () => {
    const b = one({ label: "a", bbox: { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.6 } });
    expect(b.w).toBeCloseTo(0.3); expect(b.h).toBeCloseTo(0.4);
  });
  it("clips out-of-frame", () => {
    const b = one({ label: "a", bbox: [0.8, 0.8, 0.5, 0.5] });
    expect(b.x + b.w).toBeLessThanOrEqual(1.0001);
  });
  it("drops junk", () => {
    expect(detectionsToBoxes({ detections: [{ label: "a" }] }).length).toBe(0);
  });
  it("caps at 12", () => {
    const many = Array.from({ length: 20 }, () => ({ label: "a", bbox: [0.1, 0.1, 0.2, 0.2] }));
    expect(detectionsToBoxes({ detections: many }).length).toBe(12);
  });
});
