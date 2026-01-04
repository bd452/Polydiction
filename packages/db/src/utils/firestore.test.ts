import { describe, it, expect } from "vitest";
import { countBatchResults, DEFAULT_BATCH_SIZE, processBatches } from "./firestore";

describe("DEFAULT_BATCH_SIZE", () => {
  it("should be 500 (Firestore limit)", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(500);
  });
});

describe("countBatchResults", () => {
  it("returns zero counts for empty array", () => {
    expect(countBatchResults([])).toEqual({ created: 0, updated: 0 });
  });

  it("counts all true as created", () => {
    expect(countBatchResults([true, true, true])).toEqual({ created: 3, updated: 0 });
  });

  it("counts all false as updated", () => {
    expect(countBatchResults([false, false])).toEqual({ created: 0, updated: 2 });
  });

  it("counts mixed results correctly", () => {
    expect(countBatchResults([true, false, true, false, true])).toEqual({
      created: 3,
      updated: 2,
    });
  });
});

describe("processBatches", () => {
  it("returns empty array for empty input", async () => {
    const operation = (item: number) => Promise.resolve(item * 2);
    const result = await processBatches([], operation);
    expect(result).toEqual([]);
  });

  it("processes all items with single batch", async () => {
    const items = [1, 2, 3];
    const operation = (item: number) => Promise.resolve(item * 2);
    const result = await processBatches(items, operation, 10);
    expect(result).toEqual([2, 4, 6]);
  });

  it("processes items in multiple batches", async () => {
    const items = [1, 2, 3, 4, 5];
    const operation = (item: number) => Promise.resolve(item * 2);
    const result = await processBatches(items, operation, 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("handles batch size equal to items length", async () => {
    const items = [1, 2, 3];
    const operation = (item: number) => Promise.resolve(item.toString());
    const result = await processBatches(items, operation, 3);
    expect(result).toEqual(["1", "2", "3"]);
  });

  it("handles batch size larger than items length", async () => {
    const items = [1, 2];
    const operation = (item: number) => Promise.resolve(item + 10);
    const result = await processBatches(items, operation, 100);
    expect(result).toEqual([11, 12]);
  });

  it("handles async operations correctly", async () => {
    const items = [10, 20, 30];
    const operation = async (item: number) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return item / 10;
    };
    const result = await processBatches(items, operation, 2);
    expect(result).toEqual([1, 2, 3]);
  });

  it("preserves order of results", async () => {
    const items = ["a", "b", "c", "d", "e"];
    const operation = (item: string) => Promise.resolve(item.toUpperCase());
    const result = await processBatches(items, operation, 2);
    expect(result).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("uses default batch size when not specified", async () => {
    // Create array just under default batch size
    const items = Array.from({ length: 10 }, (_, i) => i);
    const operation = (item: number) => Promise.resolve(item);
    const result = await processBatches(items, operation);
    expect(result).toHaveLength(10);
    expect(result).toEqual(items);
  });
});
