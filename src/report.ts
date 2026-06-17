export interface SentenceLike {
  index: number;
  section?: string;
  wordCount: number;
  adverbs: string[];
  rareWordCandidates: string[];
  text: string;
  styleComparison?: {
    lengthBand: string;
    wordDelta: number;
    unfamiliarAdverbs: string[];
  } | null;
}

export interface DecisionLike {
  status: string;
  note?: string;
}

export interface ReviewReportInput {
  title: string;
  sourceTitle: string;
  sentenceCount: number;
  sentences: SentenceLike[];
  decisions: Record<string, DecisionLike>;
  sentenceIdAt: (sentence: SentenceLike) => string;
  now?: () => string;
}

export function buildReviewReport(input: ReviewReportInput): string {
  const now = input.now ? input.now() : new Date().toISOString();
  const counts: Record<string, number> = {
    unreviewed: 0,
    accepted: 0,
    revise: 0,
    repeated: 0,
    delete: 0,
    unsure: 0
  };

  for (const sentence of input.sentences) {
    const decision = input.decisions[input.sentenceIdAt(sentence)];
    counts[decision ? decision.status : "unreviewed"] += 1;
  }

  const followUps = input.sentences
    .map((sentence) => ({
      sentence,
      decision: input.decisions[input.sentenceIdAt(sentence)] || { status: "unreviewed", note: "" }
    }))
    .filter(({ decision }) => decision.status !== "accepted");

  const lines = [
    "# Sentence Gate Review Report",
    "",
    `- Draft: ${input.title}`,
    `- Source: ${input.sourceTitle}`,
    `- Generated: ${now}`,
    `- Total sentences: ${input.sentenceCount}`,
    `- Reviewed: ${input.sentenceCount - counts.unreviewed}`,
    `- Accepted: ${counts.accepted}`,
    `- Revise: ${counts.revise}`,
    `- Repeated: ${counts.repeated}`,
    `- Delete: ${counts.delete}`,
    `- Unsure: ${counts.unsure}`,
    `- Unreviewed: ${counts.unreviewed}`,
    "",
    "## Follow-Up Sentences",
    ""
  ];

  if (!followUps.length) {
    lines.push("No follow-up sentences. Everything is accepted.");
  }

  for (const { sentence, decision } of followUps) {
    lines.push(`### Sentence ${sentence.index + 1}: ${decision.status}`);
    lines.push("");
    lines.push(`- Section: ${sentence.section || "Unknown"}`);
    lines.push(`- Words: ${sentence.wordCount}`);
    if (sentence.adverbs.length) {
      lines.push(`- Adverbs: ${sentence.adverbs.join(", ")}`);
    }
    if (sentence.rareWordCandidates.length) {
      lines.push(`- Rare word candidates: ${sentence.rareWordCandidates.join(", ")}`);
    }
    if (sentence.styleComparison) {
      lines.push(
        `- Style: ${sentence.styleComparison.lengthBand}, ${sentence.styleComparison.wordDelta} words vs baseline average`
      );
      if (sentence.styleComparison.unfamiliarAdverbs.length) {
        lines.push(`- Unfamiliar adverbs: ${sentence.styleComparison.unfamiliarAdverbs.join(", ")}`);
      }
    }
    if (decision.note) {
      lines.push(`- Note: ${decision.note}`);
    }
    lines.push("");
    lines.push("> " + sentence.text.replace(/\n/g, "\n> "));
    lines.push("");
  }

  return lines.join("\n");
}
