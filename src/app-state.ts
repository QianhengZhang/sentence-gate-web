import { createReviewSession } from "./core/index";
import type { ReviewRecord } from "./storage";
import { getActiveStyleProfile, getReview, saveReview, sha256Hex } from "./storage";
import type { DocumentFormat } from "./files";

export interface AppSession {
  version: number;
  title: string;
  format: string;
  createdAt: string;
  sentenceCount: number;
  sentences: any[];
}

export interface AppState {
  source: string;
  title: string;
  format: DocumentFormat;
  documentHash: string;
  session: AppSession;
  decisions: Record<string, any>;
  diagnosisCache: Record<string, any>;
  styleProfile: any | null;
}

export function markEditableSentences(session: AppSession, source: string): void {
  for (const sentence of session.sentences) {
    if (!Number.isInteger(sentence.sourceStart) || !Number.isInteger(sentence.sourceEnd)) {
      sentence.editable = false;
      continue;
    }
    const sourceText = source.slice(sentence.sourceStart, sentence.sourceEnd).replace(/\s+/g, " ").trim();
    sentence.editable = sourceText === sentence.text;
  }
}

export function buildSession(source: string, title: string, format: DocumentFormat, styleProfile: unknown): AppSession {
  const session = createReviewSession(source, { title, format, styleProfile }) as AppSession;
  markEditableSentences(session, source);
  return session;
}

export async function loadDocument(source: string, title: string, format: DocumentFormat): Promise<AppState> {
  const documentHash = await sha256Hex(source);
  const styleProfile = (await getActiveStyleProfile()) || null;
  const session = buildSession(source, title, format, styleProfile);

  const existing = await getReview(documentHash);
  const decisions = existing?.decisions ?? {};
  const diagnosisCache = existing?.diagnosisCache ?? {};

  return { source, title, format, documentHash, session, decisions, diagnosisCache, styleProfile };
}

export function replaceSourceSentence(source: string, sentence: any, replacement: string): string {
  if (!Number.isInteger(sentence.sourceStart) || !Number.isInteger(sentence.sourceEnd)) {
    throw new Error("This sentence cannot be safely mapped back to the source text yet.");
  }
  const current = source.slice(sentence.sourceStart, sentence.sourceEnd).replace(/\s+/g, " ").trim();
  if (current !== sentence.text) {
    throw new Error("The source text changed or could not be matched safely.");
  }
  return source.slice(0, sentence.sourceStart) + replacement + source.slice(sentence.sourceEnd);
}

// Matches old decisions to new sentences by exact text content via a per-text FIFO queue.
// Known limitation: if duplicate-text sentences exist and an edit changes how many
// occurrences of that exact text exist, a decision can be misattached to the wrong
// occurrence. Rare in practice; not fixed here since it mirrors the original VSCode
// extension's behavior and a real fix would need a more robust sentence-identity scheme.
export function remapDecisions(
  oldSentences: any[],
  newSentences: any[],
  oldDecisions: Record<string, any>,
  editedSentenceId: string
): Record<string, any> {
  const queues = new Map<string, any[]>();
  for (const sentence of newSentences) {
    const queue = queues.get(sentence.text) || [];
    queue.push(sentence);
    queues.set(sentence.text, queue);
  }

  const nextDecisions: Record<string, any> = {};
  for (const oldSentence of oldSentences) {
    const decision = oldDecisions[oldSentence.id];
    if (!decision || oldSentence.id === editedSentenceId) continue;
    const queue = queues.get(oldSentence.text);
    if (!queue || !queue.length) continue;
    const newSentence = queue.shift();
    nextDecisions[newSentence.id] = { ...decision, sentence: newSentence.text };
  }
  return nextDecisions;
}

export function indexAfterEdit(
  session: AppSession,
  editedSourceStart: number | undefined,
  fallbackIndex: number
): number {
  if (Number.isInteger(editedSourceStart)) {
    const exact = session.sentences.find((sentence: any) => sentence.sourceStart === editedSourceStart);
    if (exact) return exact.index;
    const next = session.sentences.find(
      (sentence: any) => Number.isInteger(sentence.sourceStart) && sentence.sourceStart > (editedSourceStart as number)
    );
    if (next) return next.index;
  }
  return Math.max(0, Math.min(fallbackIndex, session.sentences.length - 1));
}

export async function applyEdit(state: AppState, sentenceIndex: number, replacement: string): Promise<number> {
  const sentence = state.session.sentences[sentenceIndex];
  if (!sentence || !replacement.trim()) {
    throw new Error("Nothing to apply.");
  }
  if (!sentence.editable) {
    throw new Error("This sentence cannot be safely mapped back to the source text yet.");
  }

  const oldSentences = state.session.sentences;
  const oldDecisions = state.decisions;
  const editedSourceStart = sentence.sourceStart;

  const newSource = replaceSourceSentence(state.source, sentence, replacement.trim());
  const newSession = buildSession(newSource, state.title, state.format, state.styleProfile);
  const newDecisions = remapDecisions(oldSentences, newSession.sentences, oldDecisions, sentence.id);

  state.source = newSource;
  state.session = newSession;
  state.decisions = newDecisions;
  state.documentHash = await sha256Hex(newSource);

  return indexAfterEdit(newSession, editedSourceStart, sentenceIndex);
}

export async function persistReviewState(state: AppState): Promise<void> {
  const record: ReviewRecord = {
    documentHash: state.documentHash,
    title: state.session.title,
    format: state.session.format,
    sentenceCount: state.session.sentenceCount,
    decisions: state.decisions,
    diagnosisCache: state.diagnosisCache,
    savedAt: new Date().toISOString()
  };
  await saveReview(record);
}
