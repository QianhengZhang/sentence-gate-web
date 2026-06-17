export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Mark {
  start: number;
  end: number;
  className: "mark-adverb" | "mark-punctuation";
}

export function highlight(text: string, adverbs: string[]): string {
  const marks: Mark[] = [];

  for (const adverb of adverbs) {
    const re = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(adverb)})(?=[^A-Za-z]|$)`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      marks.push({
        start: match.index + match[1].length,
        end: match.index + match[0].length,
        className: "mark-adverb"
      });
    }
  }

  const punctuationRe = /(;|:|--|---|–|—|\(|\)|[A-Za-z]-[A-Za-z])/g;
  let punctuationMatch: RegExpExecArray | null;
  while ((punctuationMatch = punctuationRe.exec(text))) {
    marks.push({
      start: punctuationMatch.index,
      end: punctuationMatch.index + punctuationMatch[0].length,
      className: "mark-punctuation"
    });
  }

  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const filtered: Mark[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor) continue;
    filtered.push(mark);
    cursor = mark.end;
  }

  let html = "";
  cursor = 0;
  for (const mark of filtered) {
    html += escapeHtml(text.slice(cursor, mark.start));
    html += `<span class="${mark.className}">${escapeHtml(text.slice(mark.start, mark.end))}</span>`;
    cursor = mark.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

export function list(values: string[] | undefined): string {
  return values && values.length ? values.map(escapeHtml).join(", ") : "none";
}

export function punctuationSummary(punctuation: Record<string, number>): string {
  const parts = Object.entries(punctuation)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}: ${count}`);
  return parts.length ? parts.join(", ") : "none";
}

export interface RepetitionCandidate {
  section?: string;
  index: number;
  score: number;
  text: string;
}

export function echoSummary(candidates: RepetitionCandidate[] | undefined): string {
  if (!candidates || !candidates.length) return "none";
  return candidates
    .slice(0, 4)
    .map(
      (candidate) =>
        `<div><strong>${escapeHtml(candidate.section || "Unknown section")}</strong> ` +
        `s${candidate.index + 1} · score ${escapeHtml(candidate.score)}` +
        `<br>${escapeHtml(candidate.text)}</div>`
    )
    .join("");
}

export interface StyleProfileSummaryInput {
  documentCount: number;
  sentenceCount: number;
  averageWordCount: number;
  medianWordCount: number;
  commonAdverbs?: { value: string }[];
}

export function styleBaselineSummary(profile: StyleProfileSummaryInput | null | undefined): string {
  if (!profile) return "No style profile.";
  const commonAdverbs = (profile.commonAdverbs || []).slice(0, 5).map((entry) => entry.value).join(", ");
  return [
    `${profile.documentCount} docs, ${profile.sentenceCount} sentences`,
    `avg ${profile.averageWordCount} words`,
    `median ${profile.medianWordCount} words`,
    commonAdverbs ? `common adverbs: ${commonAdverbs}` : ""
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}

export interface StyleComparisonInput {
  lengthBand: string;
  wordDelta: number;
  unfamiliarAdverbs?: string[];
  punctuationNotes?: string[];
}

export function styleComparisonSummary(comparison: StyleComparisonInput | null | undefined): string {
  if (!comparison) return "No comparison.";
  const parts = [
    `${comparison.lengthBand} (${comparison.wordDelta} words vs avg)`,
    comparison.unfamiliarAdverbs && comparison.unfamiliarAdverbs.length
      ? `unfamiliar adverbs: ${comparison.unfamiliarAdverbs.join(", ")}`
      : "",
    comparison.punctuationNotes && comparison.punctuationNotes.length ? comparison.punctuationNotes.join("; ") : ""
  ].filter(Boolean);
  return parts.length ? parts.map(escapeHtml).join("<br>") : "near baseline";
}
