import { beforeEach, describe, expect, it } from "vitest";
import { clearApiKey, diagnosisCacheKey, extractOutputText, getApiKey, rewriteCacheKey, setApiKey } from "./openai";

beforeEach(() => {
  localStorage.clear();
});

describe("openai key storage", () => {
  it("stores, reads, and clears the API key", () => {
    expect(getApiKey()).toBeNull();
    setApiKey("  sk-test-123  ");
    expect(getApiKey()).toBe("sk-test-123");
    clearApiKey();
    expect(getApiKey()).toBeNull();
  });
});

describe("cache keys", () => {
  it("produces stable, distinct hashes per kind/model/sentence", async () => {
    const a = await diagnosisCacheKey("gpt-5.5", "The cat sat.");
    const b = await diagnosisCacheKey("gpt-5.5", "The cat sat.");
    const c = await rewriteCacheKey("gpt-5.5", "The cat sat.");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("extractOutputText", () => {
  it("prefers output_text when present", () => {
    expect(extractOutputText({ output_text: "hello" })).toBe("hello");
  });

  it("falls back to concatenating output[].content[].text", () => {
    const body = {
      output: [
        { content: [{ text: "part one" }] },
        { content: [{ text: "part two" }] }
      ]
    };
    expect(extractOutputText(body)).toBe("part one\npart two");
  });

  it("returns an empty string when nothing is found", () => {
    expect(extractOutputText({})).toBe("");
  });
});
