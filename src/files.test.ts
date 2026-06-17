import { describe, expect, it } from "vitest";
import { determineFormat } from "./files";

describe("determineFormat", () => {
  it("detects latex from .tex and .ltx", () => {
    expect(determineFormat("paper.tex")).toBe("latex");
    expect(determineFormat("paper.ltx")).toBe("latex");
  });

  it("detects markdown from .md and .markdown", () => {
    expect(determineFormat("notes.md")).toBe("markdown");
    expect(determineFormat("notes.markdown")).toBe("markdown");
  });

  it("falls back to text for anything else", () => {
    expect(determineFormat("draft.txt")).toBe("text");
    expect(determineFormat("no-extension")).toBe("text");
  });
});
