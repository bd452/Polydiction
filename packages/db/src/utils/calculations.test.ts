import { describe, it, expect } from "vitest";
import {
  calculateMedian,
  calculateRampSpeed,
  calculateConcentration,
  calculateWeightedAverage,
  calculateAverage,
  isStale,
} from "./calculations";

describe("calculateMedian", () => {
  it("returns null for empty array", () => {
    expect(calculateMedian([])).toBeNull();
  });

  it("returns the single value for array of one", () => {
    expect(calculateMedian([5])).toBe(5);
  });

  it("returns middle value for odd-length array", () => {
    expect(calculateMedian([1, 3, 5])).toBe(3);
    expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
  });

  it("returns average of middle two for even-length array", () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    expect(calculateMedian([1, 3])).toBe(2);
  });

  it("handles unsorted input", () => {
    expect(calculateMedian([5, 1, 3])).toBe(3);
    expect(calculateMedian([4, 1, 3, 2])).toBe(2.5);
  });

  it("handles duplicate values", () => {
    expect(calculateMedian([2, 2, 2])).toBe(2);
    expect(calculateMedian([1, 2, 2, 3])).toBe(2);
  });

  it("handles negative numbers", () => {
    expect(calculateMedian([-3, -1, 0, 1, 3])).toBe(0);
  });

  it("handles decimal values", () => {
    expect(calculateMedian([0.1, 0.2, 0.3])).toBe(0.2);
  });
});

describe("calculateRampSpeed", () => {
  it("returns null for zero time delta", () => {
    expect(calculateRampSpeed(0, 100, 0)).toBeNull();
  });

  it("returns null for negative time delta", () => {
    expect(calculateRampSpeed(0, 100, -1000)).toBeNull();
  });

  it("calculates positive ramp speed correctly", () => {
    // 100 units over 1 hour = 100 units/hour
    expect(calculateRampSpeed(0, 100, 3600000)).toBe(100);
  });

  it("calculates negative ramp speed correctly", () => {
    // -50 units over 1 hour = -50 units/hour
    expect(calculateRampSpeed(100, 50, 3600000)).toBe(-50);
  });

  it("scales correctly for different time windows", () => {
    // 100 units over 30 minutes = 200 units/hour
    expect(calculateRampSpeed(0, 100, 1800000)).toBe(200);

    // 100 units over 2 hours = 50 units/hour
    expect(calculateRampSpeed(0, 100, 7200000)).toBe(50);
  });

  it("returns zero for no position change", () => {
    expect(calculateRampSpeed(50, 50, 3600000)).toBe(0);
  });
});

describe("calculateConcentration", () => {
  it("returns null for zero total", () => {
    expect(calculateConcentration(100, 0)).toBeNull();
  });

  it("returns null for negative total", () => {
    expect(calculateConcentration(100, -100)).toBeNull();
  });

  it("calculates concentration correctly", () => {
    expect(calculateConcentration(25, 100)).toBe(0.25);
    expect(calculateConcentration(50, 100)).toBe(0.5);
    expect(calculateConcentration(100, 100)).toBe(1);
  });

  it("handles zero wallet position", () => {
    expect(calculateConcentration(0, 100)).toBe(0);
  });

  it("handles concentration > 1 (edge case)", () => {
    // This shouldn't happen in practice but the function handles it
    expect(calculateConcentration(150, 100)).toBe(1.5);
  });
});

describe("calculateWeightedAverage", () => {
  it("returns 0 for zero total samples", () => {
    expect(calculateWeightedAverage(0, 0, 0, 0)).toBe(0);
  });

  it("returns new value when existing count is 0", () => {
    expect(calculateWeightedAverage(0, 0, 50, 10)).toBe(50);
  });

  it("returns existing value when new count is 0", () => {
    expect(calculateWeightedAverage(50, 10, 0, 0)).toBe(50);
  });

  it("calculates weighted average correctly", () => {
    // (50 * 10 + 100 * 10) / 20 = 75
    expect(calculateWeightedAverage(50, 10, 100, 10)).toBe(75);

    // (60 * 3 + 90 * 1) / 4 = 67.5
    expect(calculateWeightedAverage(60, 3, 90, 1)).toBe(67.5);
  });

  it("weights by sample count correctly", () => {
    // (100 * 1 + 0 * 99) / 100 = 1
    expect(calculateWeightedAverage(100, 1, 0, 99)).toBe(1);

    // (0 * 99 + 100 * 1) / 100 = 1
    expect(calculateWeightedAverage(0, 99, 100, 1)).toBe(1);
  });
});

describe("calculateAverage", () => {
  it("returns null for empty array", () => {
    expect(calculateAverage([])).toBeNull();
  });

  it("returns the single value for array of one", () => {
    expect(calculateAverage([5])).toBe(5);
  });

  it("calculates average correctly", () => {
    expect(calculateAverage([1, 2, 3])).toBe(2);
    expect(calculateAverage([10, 20, 30, 40])).toBe(25);
  });

  it("handles negative numbers", () => {
    expect(calculateAverage([-10, 10])).toBe(0);
  });

  it("handles decimal values", () => {
    expect(calculateAverage([0.1, 0.2, 0.3])).toBeCloseTo(0.2);
  });
});

describe("isStale", () => {
  it("returns false when within max age", () => {
    const now = Date.now();
    expect(isStale(now - 1000, now, 5000)).toBe(false);
  });

  it("returns true when exceeds max age", () => {
    const now = Date.now();
    expect(isStale(now - 10000, now, 5000)).toBe(true);
  });

  it("returns false at exactly max age", () => {
    const now = Date.now();
    expect(isStale(now - 5000, now, 5000)).toBe(false);
  });

  it("returns true just past max age", () => {
    const now = Date.now();
    expect(isStale(now - 5001, now, 5000)).toBe(true);
  });
});
