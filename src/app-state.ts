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
