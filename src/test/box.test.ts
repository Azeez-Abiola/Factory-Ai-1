import { describe, it, expect } from "vitest";
import { detectionsToBoxes } from "@/hooks/useVisionOverlay";

const one = (d: any) => detectionsToBoxes({ detections: [d] })[0];

describe("overlay boxes", () => {
  // Boxes are padded 12% on each side into a wider "search area":
  // [0.1, 0.2, 0.3, 0.4] -> x 0.1-0.036, y 0.2-0.048, w 0.3+0.072, h 0.4+0.096
  const near = (b: any) => {
    expect(b.x).toBeCloseTo(0.064); expect(b.y).toBeCloseTo(0.152);
    expect(b.w).toBeCloseTo(0.372); expect(b.h).toBeCloseTo(0.496);
  };
  it("normalised xywh", () => near(one({ label: "a", bbox: [0.1, 0.2, 0.3, 0.4] })));
  it("percent", () => near(one({ label: "a", bbox: [10, 20, 30, 40] })));
  it("gemini box_2d ymin,xmin,ymax,xmax /1000", () => {
    const b = one({ label: "a", box_2d: [200, 100, 600, 400] });
    expect(b.x).toBeCloseTo(0.064); expect(b.y).toBeCloseTo(0.152);
    expect(b.w).toBeCloseTo(0.372); expect(b.h).toBeCloseTo(0.496);
  });
  it("corner object", () => {
    const b = one({ label: "a", bbox: { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.6 } });
    expect(b.w).toBeCloseTo(0.372); expect(b.h).toBeCloseTo(0.496);
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
