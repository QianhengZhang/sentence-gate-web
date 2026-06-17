// Verbatim port of packages/core/index.js — intentionally untyped legacy JS, kept as-is.
// @ts-nocheck
"use strict";

const COMMON_WORDS = new Set(
  `
  a able about across after all also an and another any are as at be because been
  before being between both but by can case cases change changes claim claims clear
  common could data describe different do does each effect effects example existing
  find first for from further has have how however if in include includes into is it
  its many may method methods more most need not of on one only or other our paper
  papers part present prior problem process provide provides related result results
  same section sections show shows since some such system than that the their these
  this through to two use used using very was we were what when where which while
  with within without work works would writing
  `.split(/\s+/).filter(Boolean)
);

const ACADEMIC_TERMS = new Set(
  `
  algorithm analysis analytical annotation approach citation citations corpus dataset
  empirical experiment framework geospatial hypothesis implementation interface
  interpret interpretation latex literature methodology model models qualitative
  quantitative review semantic semantics spatial statistical taxonomy theoretical
  topology validation variable variables workflow workflows
  `.split(/\s+/).filter(Boolean)
);

const ADVERB_STOPWORDS = new Set(["early", "family", "only"]);

const AI_LIKE_PATTERNS = [
  "it is important to note",
  "it should be noted",
  "delves into",
  "plays a crucial role",
  "underscores the importance",
  "in today's",
  "seamlessly",
  "robust framework",
  "comprehensive understanding",
  "valuable insights"
];

const STOPWORDS = new Set(
  `
  a about above after again against all am an and any are as at be because been
  before being below between both but by can did do does doing down during each few
  for from further had has have having he her here hers herself him himself his how
  i if in into is it its itself just me more most my myself no nor not now of off
  on once only or other our ours ourselves out over own same she should so some such
  than that the their theirs them themselves then there these they this those through
  to too under until up very was we were what when where which while who whom why
  will with you your yours yourself yourselves
  `.split(/\s+/).filter(Boolean)
);

function stripLatexComments(source) {
  return source
    .split(/\r?\n/)
    .map((line) => {
      let escaped = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === "\\" && !escaped) {
          escaped = true;
          continue;
        }
        if (ch === "%" && !escaped) {
          return line.slice(0, i);
        }
        escaped = false;
      }
      return line;
    })
    .join("\n");
}

function removeLatexBlocks(source) {
  return source
    .replace(/\\begin\{(figure|table|equation|align\*?|tikzpicture|lstlisting|verbatim)\}[\s\S]*?\\end\{\1\}/g, " ")
    .replace(/\\bibliography\{[^}]*\}/g, " ")
    .replace(/\\printbibliography\b/g, " ");
}

function unwrapSimpleLatexCommands(source) {
  let text = source;
  for (let i = 0; i < 4; i += 1) {
    text = text.replace(/\\(?:emph|textit|textbf|texttt|underline|section|subsection|subsubsection|paragraph)\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, " $1. ");
  }
  return text;
}

export function normalizeLatexToText(source) {
  let text = stripLatexComments(source);
  text = removeLatexBlocks(text);
  text = text
    .replace(/\\(?:cite|citep|citet|parencite|textcite|autocite|ref|cref|Cref|label|url|href)(?:\[[^\]]*\])*\{[^}]*\}/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\\\([\s\S]*?\\\)/g, " ");
  text = unwrapSimpleLatexCommands(text);
  text = text
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/~|``|''/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

export function splitSentences(text) {
  const sentences = [];
  const abbreviations = new Set(["e.g.", "i.e.", "Fig.", "Dr.", "Mr.", "Ms.", "Prof.", "vs.", "et al."]);
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!/[.!?]/.test(ch)) {
      continue;
    }

    const before = text.slice(Math.max(0, i - 10), i + 1);
    if ([...abbreviations].some((abbr) => before.endsWith(abbr))) {
      continue;
    }

    const next = text[i + 1] || "";
    if (next && !/\s|["')\]]/.test(next)) {
      continue;
    }

    let end = i + 1;
    while (/["')\]]/.test(text[end] || "")) {
      end += 1;
    }

    const raw = text.slice(start, end).trim();
    if (raw) {
      sentences.push(raw);
    }
    start = end;
  }

  const trailing = text.slice(start).trim();
  if (trailing) {
    sentences.push(trailing);
  }

  return sentences;
}

export function splitSentencesWithOffsets(text) {
  const records = [];
  const abbreviations = new Set(["e.g.", "i.e.", "Fig.", "Dr.", "Mr.", "Ms.", "Prof.", "vs.", "et al."]);
  let start = 0;

  function pushRange(end) {
    let rawStart = start;
    let rawEnd = end;
    while (/\s/.test(text[rawStart] || "") && rawStart < rawEnd) {
      rawStart += 1;
    }
    while (/\s/.test(text[rawEnd - 1] || "") && rawEnd > rawStart) {
      rawEnd -= 1;
    }
    const raw = text.slice(rawStart, rawEnd);
    if (raw) {
      records.push({
        text: raw.replace(/\s+/g, " "),
        start: rawStart,
        end: rawEnd
      });
    }
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!/[.!?]/.test(ch)) {
      continue;
    }

    const before = text.slice(Math.max(0, i - 10), i + 1);
    if ([...abbreviations].some((abbr) => before.endsWith(abbr))) {
      continue;
    }

    const next = text[i + 1] || "";
    if (next && !/\s|["')\]]/.test(next)) {
      continue;
    }

    let end = i + 1;
    while (/["')\]]/.test(text[end] || "")) {
      end += 1;
    }
    pushRange(end);
    start = end;
  }

  const trailing = text.slice(start);
  if (trailing.trim()) {
    pushRange(text.length);
  }

  return records;
}

function words(sentence) {
  return sentence.match(/[A-Za-z][A-Za-z'-]*/g) || [];
}

function detectAdverbs(sentence) {
  const found = [];
  for (const word of words(sentence)) {
    const lower = word.toLowerCase();
    if (lower.endsWith("ly") && !ADVERB_STOPWORDS.has(lower)) {
      found.push(word);
    }
  }
  return [...new Set(found)];
}

function detectPunctuation(sentence) {
  return {
    hyphen: (sentence.match(/[A-Za-z]-[A-Za-z]/g) || []).length,
    dash: (sentence.match(/--|---|–|—/g) || []).length,
    colon: (sentence.match(/:/g) || []).length,
    semicolon: (sentence.match(/;/g) || []).length,
    parentheses: (sentence.match(/[()]/g) || []).length
  };
}

function detectRareWordCandidates(sentence) {
  const candidates = [];
  for (const word of words(sentence)) {
    const lower = word.toLowerCase().replace(/^'+|'+$/g, "");
    if (lower.length < 8) {
      continue;
    }
    if (COMMON_WORDS.has(lower) || ACADEMIC_TERMS.has(lower)) {
      continue;
    }
    candidates.push(word);
  }
  return [...new Set(candidates)].slice(0, 12);
}

function detectAiLikePhrases(sentence) {
  const lower = sentence.toLowerCase();
  return AI_LIKE_PATTERNS.filter((pattern) => lower.includes(pattern));
}

export function analyzeSentence(sentence) {
  const sentenceWords = words(sentence);
  return {
    text: sentence,
    wordCount: sentenceWords.length,
    characterCount: sentence.length,
    adverbs: detectAdverbs(sentence),
    punctuation: detectPunctuation(sentence),
    rareWordCandidates: detectRareWordCandidates(sentence),
    aiLikePhrases: detectAiLikePhrases(sentence)
  };
}

function normalizeInlineLatex(source) {
  return normalizeLatexToText(source).replace(/\s+/g, " ").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSourceRange(rawText, normalizedSentence, sourceStart) {
  const compact = normalizedSentence.trim().replace(/\s+/g, " ");
  if (!compact) {
    return {};
  }

  const exact = rawText.indexOf(compact);
  if (exact !== -1) {
    return {
      sourceStart: sourceStart + exact,
      sourceEnd: sourceStart + exact + compact.length
    };
  }

  const flexible = new RegExp(compact.split(/\s+/).map(escapeRegex).join("\\s+"));
  const match = flexible.exec(rawText);
  if (!match) {
    return {};
  }

  return {
    sourceStart: sourceStart + match.index,
    sourceEnd: sourceStart + match.index + match[0].length
  };
}

function attachFallbackSourceRanges(source, sentences) {
  let cursor = 0;
  for (const sentence of sentences) {
    if (Number.isInteger(sentence.sourceStart) && Number.isInteger(sentence.sourceEnd)) {
      const sourceText = source.slice(sentence.sourceStart, sentence.sourceEnd).replace(/\s+/g, " ").trim();
      if (sourceText === sentence.text) {
        cursor = Math.max(cursor, sentence.sourceEnd);
        continue;
      }
    }

    const range = findSourceRange(source.slice(cursor), sentence.text, cursor);
    if (Number.isInteger(range.sourceStart) && Number.isInteger(range.sourceEnd)) {
      sentence.sourceStart = range.sourceStart;
      sentence.sourceEnd = range.sourceEnd;
      cursor = range.sourceEnd;
    } else {
      delete sentence.sourceStart;
      delete sentence.sourceEnd;
    }
  }
}

function lineRecords(source) {
  const lines = source.split(/\r?\n/);
  const records = [];
  let offset = 0;
  for (const line of lines) {
    records.push({
      text: line,
      start: offset,
      end: offset + line.length
    });
    offset += line.length + 1;
  }
  return records;
}

function sectionLevel(command) {
  if (command === "section") {
    return 1;
  }
  if (command === "subsection") {
    return 2;
  }
  if (command === "subsubsection") {
    return 3;
  }
  return 4;
}

export function extractSentenceRecords(source) {
  const withoutBlocks = removeLatexBlocks(stripLatexComments(source))
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\\[[\s\S]*?\\\]/g, " ")
    .replace(/\\\([\s\S]*?\\\)/g, " ");
  const lines = lineRecords(withoutBlocks);
  const records = [];
  let currentSection = "Front matter";
  let currentSectionLevel = 0;
  let paragraphLines = [];
  let paragraphIndex = 0;

  function flushParagraph() {
    const raw = paragraphLines.map((line) => line.text).join("\n").trim();
    const rawStart = paragraphLines.length ? paragraphLines[0].start : 0;
    paragraphLines = [];
    if (!raw) {
      return;
    }

    const paragraphText = normalizeInlineLatex(raw);
    if (!paragraphText) {
      return;
    }

    const paragraphSentences = splitSentences(paragraphText);
    for (const sentence of paragraphSentences) {
      records.push({
        section: currentSection,
        sectionLevel: currentSectionLevel,
        paragraphIndex,
        ...findSourceRange(raw, sentence, rawStart),
        ...analyzeSentence(sentence)
      });
    }
    paragraphIndex += 1;
  }

  for (const line of lines) {
    const sectionMatch = line.text.match(/^\s*\\(section|subsection|subsubsection|paragraph)\*?(?:\[[^\]]*\])?\{([^{}]*)\}/);
    if (sectionMatch) {
      flushParagraph();
      currentSection = normalizeInlineLatex(sectionMatch[2]) || currentSection;
      currentSectionLevel = sectionLevel(sectionMatch[1]);
      const rest = line.text.slice(sectionMatch[0].length).trim();
      if (rest) {
        paragraphLines.push({
          text: rest,
          start: line.start + line.text.indexOf(rest),
          end: line.end
        });
      }
      continue;
    }

    if (!line.text.trim()) {
      flushParagraph();
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return records;
}

function stripMarkdownSentenceDecorations(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~#>]/g, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .trim();
}

export function extractTextSentenceRecords(source, options = {}) {
  const format = options.format || "text";
  const records = [];
  const lines = lineRecords(source);
  let paragraphLines = [];
  let paragraphIndex = 0;
  let currentSection = "Pasted text";

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }
    const raw = paragraphLines.map((line) => line.text).join("\n");
    const sourceStart = paragraphLines[0].start;
    paragraphLines = [];

    for (const sentence of splitSentencesWithOffsets(raw)) {
      const displayText = format === "markdown"
        ? stripMarkdownSentenceDecorations(sentence.text)
        : sentence.text.replace(/\s+/g, " ");
      if (!displayText) {
        continue;
      }
      records.push({
        section: currentSection,
        sectionLevel: currentSection === "Pasted text" ? 0 : 1,
        paragraphIndex,
        sourceStart: sourceStart + sentence.start,
        sourceEnd: sourceStart + sentence.end,
        ...analyzeSentence(displayText)
      });
    }
    paragraphIndex += 1;
  }

  let inCodeFence = false;
  for (const line of lines) {
    if (format === "markdown" && /^\s*```/.test(line.text)) {
      flushParagraph();
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      continue;
    }

    const heading = format === "markdown" ? line.text.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) : null;
    if (heading) {
      flushParagraph();
      currentSection = heading[1].trim();
      continue;
    }

    if (!line.text.trim()) {
      flushParagraph();
      continue;
    }

    paragraphLines.push(line);
  }
  flushParagraph();

  return records;
}

function contentTokens(sentence) {
  return words(sentence)
    .map((word) => word.toLowerCase().replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 3 && !STOPWORDS.has(word))
    .map((word) => word
      .replace(/ies$/, "y")
      .replace(/ing$/, "")
      .replace(/ed$/, "")
      .replace(/s$/, "")
    )
    .filter(Boolean);
}

function jaccardScore(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function findRepetitionCandidates(sentences, index, options = {}) {
  const limit = options.limit || 6;
  const minScore = options.minScore || 0.12;
  const current = sentences[index];
  if (!current) {
    return [];
  }

  const currentTokens = contentTokens(current.text);
  return sentences
    .filter((candidate) => candidate.index !== index && Math.abs(candidate.index - index) > 1)
    .map((candidate) => ({
      id: candidate.id,
      index: candidate.index,
      section: candidate.section,
      paragraphIndex: candidate.paragraphIndex,
      distance: candidate.index - index,
      score: Number(jaccardScore(currentTokens, contentTokens(candidate.text)).toFixed(3)),
      text: candidate.text
    }))
    .filter((candidate) => candidate.score >= minScore)
    .sort((a, b) => b.score - a.score || Math.abs(b.distance) - Math.abs(a.distance))
    .slice(0, limit);
}

function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function topEntries(map, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function createStyleProfile(documents, options = {}) {
  const sentences = [];
  for (const document of documents) {
    const session = createReviewSession(document.source, {
      title: document.title,
      format: document.format || "text"
    });
    sentences.push(...session.sentences);
  }

  const wordCounts = sentences.map((sentence) => sentence.wordCount);
  const adverbs = new Map();
  const rareWords = new Map();
  const punctuationTotals = {
    hyphen: 0,
    dash: 0,
    colon: 0,
    semicolon: 0,
    parentheses: 0
  };

  let adverbSentenceCount = 0;
  for (const sentence of sentences) {
    if (sentence.adverbs.length) {
      adverbSentenceCount += 1;
    }
    for (const adverb of sentence.adverbs) {
      const lower = adverb.toLowerCase();
      adverbs.set(lower, (adverbs.get(lower) || 0) + 1);
    }
    for (const rareWord of sentence.rareWordCandidates) {
      const lower = rareWord.toLowerCase();
      rareWords.set(lower, (rareWords.get(lower) || 0) + 1);
    }
    for (const key of Object.keys(punctuationTotals)) {
      punctuationTotals[key] += sentence.punctuation[key] || 0;
    }
  }

  const sentenceCount = sentences.length;
  const averageWordCount = sentenceCount
    ? wordCounts.reduce((sum, value) => sum + value, 0) / sentenceCount
    : 0;

  return {
    version: 1,
    title: options.title || "Author style profile",
    generatedAt: new Date().toISOString(),
    documentCount: documents.length,
    sentenceCount,
    averageWordCount: Number(averageWordCount.toFixed(1)),
    medianWordCount: Number(median(wordCounts).toFixed(1)),
    adverbSentenceRate: sentenceCount ? Number((adverbSentenceCount / sentenceCount).toFixed(3)) : 0,
    punctuationPerSentence: Object.fromEntries(
      Object.entries(punctuationTotals).map(([key, total]) => [
        key,
        sentenceCount ? Number((total / sentenceCount).toFixed(3)) : 0
      ])
    ),
    commonAdverbs: topEntries(adverbs),
    commonRareWordCandidates: topEntries(rareWords)
  };
}

export function compareSentenceToStyle(sentence, profile) {
  if (!profile || !profile.sentenceCount) {
    return null;
  }

  const wordDelta = sentence.wordCount - profile.averageWordCount;
  const commonAdverbs = new Set((profile.commonAdverbs || []).map((entry) => entry.value));
  const unfamiliarAdverbs = sentence.adverbs
    .map((adverb) => adverb.toLowerCase())
    .filter((adverb) => !commonAdverbs.has(adverb));
  const punctuationNotes = [];

  for (const [name, count] of Object.entries(sentence.punctuation || {})) {
    const baseline = profile.punctuationPerSentence && profile.punctuationPerSentence[name]
      ? profile.punctuationPerSentence[name]
      : 0;
    if (count > 0 && baseline < 0.05) {
      punctuationNotes.push(`${name} is uncommon in the style corpus`);
    }
  }

  let lengthBand = "near baseline";
  if (wordDelta >= 8) {
    lengthBand = "longer than baseline";
  } else if (wordDelta <= -8) {
    lengthBand = "shorter than baseline";
  }

  return {
    baselineAverageWords: profile.averageWordCount,
    wordDelta: Number(wordDelta.toFixed(1)),
    lengthBand,
    unfamiliarAdverbs,
    punctuationNotes
  };
}

export function createReviewSession(source, options = {}) {
  const format = options.format || "latex";
  const extractor = format === "latex" ? extractSentenceRecords : extractTextSentenceRecords;
  const sentences = extractor(source, { format }).map((record, index) => ({
    id: `s-${index + 1}`,
    index,
    ...record
  }));

  attachFallbackSourceRanges(source, sentences);

  for (let index = 0; index < sentences.length; index += 1) {
    sentences[index].repetitionCandidates = findRepetitionCandidates(sentences, index);
    sentences[index].styleComparison = options.styleProfile
      ? compareSentenceToStyle(sentences[index], options.styleProfile)
      : null;
  }

  return {
    version: 1,
    title: options.title || "Untitled draft",
    format,
    createdAt: new Date().toISOString(),
    sentenceCount: sentences.length,
    sentences
  };
}
