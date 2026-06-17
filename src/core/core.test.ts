import { describe, expect, it } from "vitest";
import {
  analyzeSentence,
  createReviewSession,
  createStyleProfile,
  extractTextSentenceRecords,
  findRepetitionCandidates,
  normalizeLatexToText,
  splitSentences
} from "./index";

const sample = `
\\section{Introduction}
This paper notably examines AI-assisted writing workflows. % remove this
These workflows can create repeated claims across independently drafted sections; this is hard to notice.
As shown by \\citet{smith2024}, sentence-level review matters.
\\begin{figure}
ignored.
\\end{figure}
`;

describe("core sentence engine", () => {
  it("normalizes LaTeX to plain text", () => {
    const clean = normalizeLatexToText(sample);
    expect(clean).toMatch(/Introduction/);
    expect(clean).not.toMatch(/remove this/);
    expect(clean).not.toMatch(/ignored/);
    expect(clean).not.toMatch(/smith2024/);
  });

  it("splits sentences", () => {
    const clean = normalizeLatexToText(sample);
    const sentences = splitSentences(clean);
    expect(sentences.length).toBe(4);

    const analysis = analyzeSentence(sentences[1]);
    expect(analysis.wordCount).toBe(7);
    expect(analysis.adverbs).toEqual(["notably"]);
    expect(analysis.punctuation.hyphen).toBe(1);
  });

  it("builds a review session from LaTeX", () => {
    const session = createReviewSession(sample, { title: "Sample" });
    expect(session.title).toBe("Sample");
    expect(session.sentenceCount).toBe(3);
    expect(session.sentences[0].section).toBe("Introduction");
    expect(session.sentences[1].punctuation.semicolon).toBe(1);
  });

  it("finds repetition candidates across sections", () => {
    const repeated = createReviewSession(`
\\section{Introduction}
Sentence-level review helps authors catch repeated claims across independently drafted sections.

\\section{Method}
The tool presents one sentence at a time.

\\section{Discussion}
Authors can catch repeated claims when sections are drafted independently.
`);
    const candidates = findRepetitionCandidates(repeated.sentences, 0, { minScore: 0.1 });
    expect(candidates[0].section).toBe("Discussion");
    expect(candidates[0].text).toMatch(/repeated claims/);
  });

  it("builds a review session from plain text", () => {
    const textSession = createReviewSession("First sentence. Second sentence is here.", {
      title: "Plain",
      format: "text"
    });
    expect(textSession.format).toBe("text");
    expect(textSession.sentenceCount).toBe(2);
    expect(textSession.sentences[1].sourceStart).toBe(16);
    expect(textSession.sentences[1].sourceEnd).toBe(40);
  });

  it("extracts sentence records from markdown", () => {
    const markdownRecords = extractTextSentenceRecords(
      "# Intro\n\nThis **sentence** is readable. [This one](https://example.com) has a link.",
      { format: "markdown" }
    );
    expect(markdownRecords[0].section).toBe("Intro");
    expect(markdownRecords[0].text).toBe("This sentence is readable.");
    expect(markdownRecords[1].text).toBe("This one has a link.");
  });

  it("builds a style profile and compares a sentence against it", () => {
    const styleProfile = createStyleProfile([
      {
        title: "old-paper.txt",
        format: "text",
        source: "We examine sentence review. We carefully revise academic claims."
      }
    ]);
    expect(styleProfile.documentCount).toBe(1);
    expect(styleProfile.sentenceCount).toBe(2);
    expect(styleProfile.averageWordCount).toBe(4.5);
    expect(styleProfile.commonAdverbs[0].value).toBe("carefully");

    const styledSession = createReviewSession(
      "This sentence is much longer than the old concise baseline because it keeps adding extra qualifying material, unfortunately.",
      { format: "text", styleProfile }
    );
    expect(styledSession.sentences[0].styleComparison.lengthBand).toBe("longer than baseline");
    expect(styledSession.sentences[0].styleComparison.unfamiliarAdverbs).toEqual(["unfortunately"]);
  });
});
