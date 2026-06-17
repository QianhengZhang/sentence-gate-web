import { describe, expect, it } from "vitest";
import { escapeHtml, highlight, list, punctuationSummary, styleBaselineSummary, styleComparisonSummary } from "./render-helpers";

describe("escapeHtml", () => {
  it("escapes html-significant characters", () => {
    expect(escapeHtml("<a>&'\"")).toBe("&lt;a&gt;&amp;&#039;&quot;");
  });
});

describe("highlight", () => {
  it("wraps adverbs and punctuation in marker spans", () => {
    const html = highlight("This works well; it is notably good.", ["notably"]);
    expect(html).toContain('<span class="mark-adverb">notably</span>');
    expect(html).toContain('<span class="mark-punctuation">;</span>');
  });

  it("escapes plain text outside marks", () => {
    const html = highlight("a < b", []);
    expect(html).toBe("a &lt; b");
  });
});

describe("list", () => {
  it("joins values or returns none", () => {
    expect(list(["a", "b"])).toBe("a, b");
    expect(list([])).toBe("none");
    expect(list(undefined)).toBe("none");
  });
});

describe("punctuationSummary", () => {
  it("only includes non-zero counts", () => {
    expect(punctuationSummary({ hyphen: 0, dash: 0, colon: 2, semicolon: 0, parentheses: 1 })).toBe(
      "colon: 2, parentheses: 1"
    );
    expect(punctuationSummary({ hyphen: 0, dash: 0, colon: 0, semicolon: 0, parentheses: 0 })).toBe("none");
  });
});

describe("styleBaselineSummary", () => {
  it("formats a profile summary", () => {
    const summary = styleBaselineSummary({
      documentCount: 2,
      sentenceCount: 50,
      averageWordCount: 18.4,
      medianWordCount: 17,
      commonAdverbs: [{ value: "clearly" }, { value: "often" }]
    });
    expect(summary).toContain("2 docs, 50 sentences");
    expect(summary).toContain("common adverbs: clearly, often");
  });

  it("reports no profile", () => {
    expect(styleBaselineSummary(null)).toBe("No style profile.");
  });
});

describe("styleComparisonSummary", () => {
  it("reports near baseline when nothing stands out", () => {
    expect(styleComparisonSummary({ lengthBand: "near baseline", wordDelta: 0.5 })).toContain("near baseline");
  });

  it("reports no comparison", () => {
    expect(styleComparisonSummary(null)).toBe("No comparison.");
  });
});
