import { describe, expect, it } from "vitest";
import { buildReviewReport } from "./report";

const sentences = [
  { index: 0, section: "Intro", wordCount: 5, adverbs: ["notably"], rareWordCandidates: [], text: "This notably matters." },
  { index: 1, section: "Intro", wordCount: 3, adverbs: [], rareWordCandidates: [], text: "It is short." }
];

describe("buildReviewReport", () => {
  it("counts statuses and lists only non-accepted sentences", () => {
    const report = buildReviewReport({
      title: "Sample",
      sourceTitle: "sample.tex",
      sentenceCount: 2,
      sentences,
      decisions: {
        "s-1": { status: "accepted" },
        "s-2": { status: "revise", note: "tighten this" }
      },
      sentenceIdAt: (sentence) => `s-${sentence.index + 1}`,
      now: () => "2026-06-17T00:00:00.000Z"
    });

    expect(report).toContain("- Accepted: 1");
    expect(report).toContain("- Revise: 1");
    expect(report).toContain("### Sentence 2: revise");
    expect(report).not.toContain("### Sentence 1:");
    expect(report).toContain("- Note: tighten this");
  });

  it("reports a clean draft when everything is accepted", () => {
    const report = buildReviewReport({
      title: "Sample",
      sourceTitle: "sample.tex",
      sentenceCount: 2,
      sentences,
      decisions: { "s-1": { status: "accepted" }, "s-2": { status: "accepted" } },
      sentenceIdAt: (sentence) => `s-${sentence.index + 1}`,
      now: () => "2026-06-17T00:00:00.000Z"
    });
    expect(report).toContain("No follow-up sentences. Everything is accepted.");
  });
});
