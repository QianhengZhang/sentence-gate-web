import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStyleProfile,
  getActiveStyleProfile,
  getReview,
  getSetting,
  saveReview,
  saveStyleProfile,
  setSetting,
  sha256Hex
} from "./storage";

beforeEach(async () => {
  // fresh fake-indexeddb database per test file run; each test uses unique keys
});

describe("storage", () => {
  it("hashes text deterministically", async () => {
    const a = await sha256Hex("hello world");
    const b = await sha256Hex("hello world");
    const c = await sha256Hex("different");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips a review record", async () => {
    const record = {
      documentHash: "test-hash-1",
      title: "Sample",
      format: "text",
      sentenceCount: 2,
      decisions: { "s-1": { status: "accepted", note: "", sentence: "x", updatedAt: "now" } },
      diagnosisCache: {},
      savedAt: "2026-06-17T00:00:00.000Z"
    };
    await saveReview(record);
    const loaded = await getReview("test-hash-1");
    expect(loaded).toEqual(record);
  });

  it("returns undefined for a missing review", async () => {
    const loaded = await getReview("does-not-exist");
    expect(loaded).toBeUndefined();
  });

  it("round-trips the active style profile", async () => {
    await saveStyleProfile({ title: "My style", sentenceCount: 10 });
    const loaded = await getActiveStyleProfile();
    expect(loaded?.title).toBe("My style");
    expect(loaded?.id).toBe("active");

    await clearStyleProfile();
    const cleared = await getActiveStyleProfile();
    expect(cleared).toBeUndefined();
  });

  it("round-trips settings", async () => {
    await setSetting("openaiModel", "gpt-5.5");
    const value = await getSetting<string>("openaiModel");
    expect(value).toBe("gpt-5.5");
  });
});
