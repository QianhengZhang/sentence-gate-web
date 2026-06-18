import type { AppState } from "./app-state";
import { applyEdit, persistReviewState } from "./app-state";
import {
  echoSummary,
  escapeHtml,
  highlight,
  list,
  punctuationSummary,
  styleBaselineSummary,
  styleComparisonSummary
} from "./render-helpers";
import { diagnoseSentence, diagnosisCacheKey, rewriteCacheKey, suggestRewriteOptions } from "./openai";
import { getSetting } from "./storage";
import { buildReviewReport } from "./report";
import { downloadText } from "./files";

interface Decision {
  status: string;
  note: string;
  sentence: string;
  updatedAt: string;
}

const CONTEXT_COLLAPSED_KEY = "sentenceGate.contextCollapsed";

let state: AppState;
let index = 0;
let filter = "all";
const aiBySentence: Record<string, any> = {};
const rewriteBySentence: Record<string, any> = {};
let readSentenceId: string | null = null;
let lastAutoReadId: string | null = null;
let speechPlaybackState: "idle" | "speaking" | "paused" = "idle";
// Stays set while paused (only cleared in stopSpeaking/onend/onerror) so navigating
// away while paused still triggers cleanup via resetReadStateForCurrentSentence.
let speakingForSentenceId: string | null = null;

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const els = {
  previous: byId("previous"),
  currentMini: byId("currentMini"),
  next: byId("next"),
  counter: byId("counter"),
  location: byId("location"),
  status: byId("status"),
  progress: byId("progress"),
  filter: byId<HTMLSelectElement>("filter"),
  filterCount: byId("filterCount"),
  autoRead: byId<HTMLInputElement>("autoRead"),
  requireRead: byId<HTMLInputElement>("requireRead"),
  readStatus: byId("readStatus"),
  speakBtn: byId<HTMLButtonElement>("speakBtn"),
  sentence: byId("sentence"),
  editText: byId<HTMLTextAreaElement>("editText"),
  applyEditBtn: byId<HTMLButtonElement>("applyEditBtn"),
  revealBtn: byId<HTMLButtonElement>("revealBtn"),
  editStatus: byId("editStatus"),
  note: byId<HTMLTextAreaElement>("note"),
  reviewProgress: byId("reviewProgress"),
  statusCounts: byId("statusCounts"),
  sectionProgress: byId("sectionProgress"),
  styleBaseline: byId("styleBaseline"),
  styleComparison: byId("styleComparison"),
  length: byId("length"),
  adverbs: byId("adverbs"),
  punctuation: byId("punctuation"),
  rare: byId("rare"),
  phrases: byId("phrases"),
  echo: byId("echo"),
  aiResult: byId("aiResult"),
  rewriteResult: byId("rewriteResult"),
  workflowStatus: byId("workflowStatus"),
  shell: byId("shell"),
  toggleContextBtn: byId<HTMLButtonElement>("toggleContextBtn")
};

function currentSentence(): any {
  return state.session.sentences[index];
}

function statusFor(item: any): string {
  return state.decisions[item.id] ? state.decisions[item.id].status : "unreviewed";
}

function filteredIndices(): number[] {
  const indices: number[] = [];
  for (const item of state.session.sentences) {
    if (filter === "all" || statusFor(item) === filter) {
      indices.push(item.index);
    }
  }
  return indices;
}

function currentFilteredPosition(): { indices: number[]; position: number } {
  const indices = filteredIndices();
  return { indices, position: indices.indexOf(index) };
}

function moveWithinFilter(delta: number): void {
  const { indices, position } = currentFilteredPosition();
  if (!indices.length) return;
  if (position === -1) {
    index = indices[0];
    render();
    return;
  }
  const nextPosition = Math.max(0, Math.min(indices.length - 1, position + delta));
  index = indices[nextPosition];
  render();
}

function resetReadStateForCurrentSentence(): void {
  if (readSentenceId !== currentSentence().id) {
    readSentenceId = null;
  }
  if (speakingForSentenceId !== null && speakingForSentenceId !== currentSentence().id) {
    stopSpeaking();
  }
}

function markRead(sentenceId: string): void {
  if (sentenceId !== currentSentence().id) return;
  readSentenceId = sentenceId;
  els.readStatus.textContent = "read";
}

function hasReadCurrentSentence(): boolean {
  return readSentenceId === currentSentence().id;
}

function nextFilteredIndexAfter(oldIndex: number): number {
  const indices = filteredIndices();
  if (!indices.length) return oldIndex;
  const next = indices.find((candidate) => candidate > oldIndex);
  return next === undefined ? indices[indices.length - 1] : next;
}

function reviewStats(): { counts: Record<string, number>; reviewed: number } {
  const counts: Record<string, number> = {
    unreviewed: 0,
    accepted: 0,
    revise: 0,
    repeated: 0,
    delete: 0,
    unsure: 0
  };
  for (const item of state.session.sentences) {
    counts[statusFor(item)] += 1;
  }
  const reviewed = state.session.sentenceCount - counts.unreviewed;
  return { counts, reviewed };
}

function sectionStats(section: string): { total: number; reviewed: number } {
  const items = state.session.sentences.filter((item: any) => item.section === section);
  const reviewed = items.filter((item: any) => statusFor(item) !== "unreviewed").length;
  return { total: items.length, reviewed };
}

function renderAi(value: any): void {
  if (!value) {
    els.aiResult.textContent = "Not requested.";
    return;
  }
  if (value.loading) {
    els.aiResult.textContent = "Diagnosing...";
    return;
  }
  if (value.error) {
    els.aiResult.textContent = value.error;
    return;
  }
  els.aiResult.innerHTML = [
    `<div><strong>Source:</strong> ${value.cached ? "cache" : "API"}</div>`,
    `<div><strong>Clarity:</strong> ${escapeHtml(value.clarity)}</div>`,
    `<div><strong>Naturalness:</strong> ${escapeHtml(value.naturalness)}</div>`,
    `<div><strong>Main concern:</strong> ${escapeHtml(value.main_concern)}</div>`,
    `<div><strong>Suspicious words:</strong> ${list(value.suspicious_words)}</div>`,
    `<div><strong>Document Echo:</strong> ${escapeHtml(value.repetition_risk)}</div>`,
    `<div><strong>Style:</strong> ${escapeHtml(value.style_note)}</div>`,
    `<div><strong>Human action:</strong> ${escapeHtml(value.human_action)}</div>`
  ].join("");
}

function renderRewrite(value: any): void {
  if (!value) {
    els.rewriteResult.textContent = "Not requested.";
    return;
  }
  if (value.loading) {
    els.rewriteResult.textContent = "Generating options...";
    return;
  }
  if (value.error) {
    els.rewriteResult.textContent = value.error;
    return;
  }

  const optionHtml = (key: "minimal_edit" | "natural_academic", label: string): string => {
    const option = value[key];
    if (!option) return "";
    return [
      '<div class="rewrite-option">',
      `<strong>${escapeHtml(label)}</strong>`,
      `<div>${escapeHtml(option.text)}</div>`,
      `<div class="kicker">${escapeHtml(option.rationale)}</div>`,
      `<button data-rewrite-key="${escapeHtml(key)}">Use in editor</button>`,
      "</div>"
    ].join("");
  };

  els.rewriteResult.innerHTML = [
    `<div><strong>Source:</strong> ${value.cached ? "cache" : "API"}</div>`,
    optionHtml("minimal_edit", "Minimal edit"),
    optionHtml("natural_academic", "Natural academic"),
    value.caution ? `<div><strong>Caution:</strong> ${escapeHtml(value.caution)}</div>` : ""
  ].join("");

  els.rewriteResult.querySelectorAll<HTMLButtonElement>("[data-rewrite-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.rewriteKey as "minimal_edit" | "natural_academic";
      const option = value[key];
      if (option && option.text) {
        els.editText.value = option.text;
        els.editStatus.textContent = "rewrite option loaded";
      }
    });
  });
}

function render(): void {
  const item = currentSentence();
  resetReadStateForCurrentSentence();
  const previous = state.session.sentences[index - 1];
  const next = state.session.sentences[index + 1];
  const decision: Decision | undefined = state.decisions[item.id];
  const stats = reviewStats();
  const section = sectionStats(item.section);
  const filtered = currentFilteredPosition();

  els.previous.textContent = previous ? previous.text : "Start of draft.";
  els.currentMini.textContent = item.text;
  els.next.textContent = next ? next.text : "End of draft.";
  els.counter.textContent = `Sentence ${index + 1} / ${state.session.sentenceCount}`;
  els.location.textContent = item.section ? `Section: ${item.section}` : "";
  els.status.textContent = decision ? decision.status : "unreviewed";
  els.readStatus.textContent = hasReadCurrentSentence() ? "read" : "not read";
  els.progress.style.width = `${((stats.reviewed / state.session.sentenceCount) * 100).toFixed(1)}%`;
  els.filter.value = filter;
  els.filterCount.textContent = filtered.indices.length
    ? `Showing ${filtered.position + 1} / ${filtered.indices.length}`
    : "No sentences in this filter";
  els.sentence.innerHTML = highlight(item.text, item.adverbs);
  els.editText.value = item.text;
  const editable = Boolean(item.editable);
  const canReveal = Boolean(Number.isInteger(item.sourceStart) && Number.isInteger(item.sourceEnd));
  els.applyEditBtn.disabled = !editable;
  els.revealBtn.disabled = !canReveal;
  els.editStatus.textContent = editable ? "can apply" : "review only";
  els.note.value = decision && decision.note ? decision.note : "";
  els.reviewProgress.textContent = `${stats.reviewed} / ${state.session.sentenceCount} reviewed`;
  els.statusCounts.innerHTML = [
    `accepted ${stats.counts.accepted}`,
    `revise ${stats.counts.revise}`,
    `repeated ${stats.counts.repeated}`,
    `delete ${stats.counts.delete}`,
    `unsure ${stats.counts.unsure}`,
    `unreviewed ${stats.counts.unreviewed}`
  ]
    .map(escapeHtml)
    .join("<br>");
  els.sectionProgress.textContent = item.section
    ? `${item.section}: ${section.reviewed} / ${section.total} reviewed`
    : "none";
  els.styleBaseline.innerHTML = styleBaselineSummary(state.styleProfile);
  els.styleComparison.innerHTML = styleComparisonSummary(item.styleComparison);
  els.length.textContent = `${item.wordCount} words, ${item.characterCount} characters`;
  els.adverbs.innerHTML = list(item.adverbs);
  els.punctuation.textContent = punctuationSummary(item.punctuation);
  els.rare.innerHTML = list(item.rareWordCandidates);
  els.phrases.innerHTML = list(item.aiLikePhrases);
  els.echo.innerHTML = echoSummary(item.repetitionCandidates);
  renderAi(aiBySentence[item.id]);
  renderRewrite(rewriteBySentence[item.id]);
  if (els.autoRead.checked && lastAutoReadId !== item.id) {
    lastAutoReadId = item.id;
    setTimeout(() => speak(), 80);
  }
}

function decide(status: string): void {
  const item = currentSentence();
  if (status === "accepted" && els.requireRead.checked && !hasReadCurrentSentence()) {
    els.workflowStatus.textContent = "read this sentence first";
    return;
  }
  const oldIndex = index;
  state.decisions[item.id] = {
    status,
    note: els.note.value,
    sentence: item.text,
    updatedAt: new Date().toISOString()
  };
  void persistReviewState(state);
  index = nextFilteredIndexAfter(oldIndex);
  render();
}

function updateSpeakButtonLabel(): void {
  els.speakBtn.textContent =
    speechPlaybackState === "speaking" ? "Pause" : speechPlaybackState === "paused" ? "Resume" : "Read Aloud";
}

function stopSpeaking(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  speechPlaybackState = "idle";
  speakingForSentenceId = null;
  updateSpeakButtonLabel();
}

function speak(): void {
  const speakingSentenceId = currentSentence().id;
  if (!("speechSynthesis" in window)) {
    markRead(speakingSentenceId);
    return;
  }
  window.speechSynthesis.cancel();
  els.readStatus.textContent = "reading...";
  const utterance = new SpeechSynthesisUtterance(currentSentence().text);
  utterance.rate = 0.88;
  utterance.onend = () => {
    speechPlaybackState = "idle";
    speakingForSentenceId = null;
    updateSpeakButtonLabel();
    markRead(speakingSentenceId);
  };
  utterance.onerror = () => {
    speechPlaybackState = "idle";
    speakingForSentenceId = null;
    updateSpeakButtonLabel();
    markRead(speakingSentenceId);
  };
  window.speechSynthesis.speak(utterance);
  speechPlaybackState = "speaking";
  speakingForSentenceId = speakingSentenceId;
  updateSpeakButtonLabel();
}

function toggleSpeech(): void {
  if (speechPlaybackState === "idle") {
    speak();
    return;
  }
  if (!("speechSynthesis" in window)) return;
  if (speechPlaybackState === "speaking") {
    window.speechSynthesis.pause();
    speechPlaybackState = "paused";
  } else if (speechPlaybackState === "paused") {
    window.speechSynthesis.resume();
    speechPlaybackState = "speaking";
  }
  updateSpeakButtonLabel();
}

async function askAi(): Promise<void> {
  const item = currentSentence();
  aiBySentence[item.id] = { loading: true };
  renderAi(aiBySentence[item.id]);
  try {
    const model = (await getSetting<string>("openaiModel")) || "gpt-5.5";
    const maxContext = (await getSetting<number>("maxContextSentences")) ?? 1;
    const cacheKey = await diagnosisCacheKey(model, item.text);
    const cached = state.diagnosisCache[cacheKey] as any;
    if (cached && cached.diagnosis) {
      aiBySentence[item.id] = { ...cached.diagnosis, cached: true };
      if (currentSentence().id === item.id) renderAi(aiBySentence[item.id]);
      return;
    }

    const diagnosis = await diagnoseSentence({
      model,
      sentence: item,
      previous: state.session.sentences.slice(Math.max(0, index - maxContext), index).map((s: any) => s.text),
      next: state.session.sentences.slice(index + 1, index + 1 + maxContext).map((s: any) => s.text),
      repetitionCandidates: item.repetitionCandidates || [],
      styleProfile: state.styleProfile
    });
    state.diagnosisCache[cacheKey] = { model, sentence: item.text, diagnosis, updatedAt: new Date().toISOString() };
    await persistReviewState(state);
    aiBySentence[item.id] = diagnosis;
    if (currentSentence().id === item.id) renderAi(aiBySentence[item.id]);
  } catch (error) {
    aiBySentence[item.id] = { error: error instanceof Error ? error.message : String(error) };
    if (currentSentence().id === item.id) renderAi(aiBySentence[item.id]);
  }
}

async function askRewrite(): Promise<void> {
  const item = currentSentence();
  rewriteBySentence[item.id] = { loading: true };
  renderRewrite(rewriteBySentence[item.id]);
  try {
    const model = (await getSetting<string>("openaiModel")) || "gpt-5.5";
    const maxContext = (await getSetting<number>("maxContextSentences")) ?? 1;
    const cacheKey = await rewriteCacheKey(model, item.text);
    const cached = state.diagnosisCache[cacheKey] as any;
    if (cached && cached.rewriteOptions) {
      rewriteBySentence[item.id] = { ...cached.rewriteOptions, cached: true };
      if (currentSentence().id === item.id) renderRewrite(rewriteBySentence[item.id]);
      return;
    }

    const rewriteOptions = await suggestRewriteOptions({
      model,
      sentence: item,
      previous: state.session.sentences.slice(Math.max(0, index - maxContext), index).map((s: any) => s.text),
      next: state.session.sentences.slice(index + 1, index + 1 + maxContext).map((s: any) => s.text),
      styleProfile: state.styleProfile
    });
    state.diagnosisCache[cacheKey] = {
      model,
      sentence: item.text,
      rewriteOptions,
      updatedAt: new Date().toISOString()
    };
    await persistReviewState(state);
    rewriteBySentence[item.id] = rewriteOptions;
    if (currentSentence().id === item.id) renderRewrite(rewriteBySentence[item.id]);
  } catch (error) {
    rewriteBySentence[item.id] = { error: error instanceof Error ? error.message : String(error) };
    if (currentSentence().id === item.id) renderRewrite(rewriteBySentence[item.id]);
  }
}

function exportReport(): void {
  const report = buildReviewReport({
    title: state.session.title,
    sourceTitle: state.title,
    sentenceCount: state.session.sentenceCount,
    sentences: state.session.sentences,
    decisions: state.decisions,
    sentenceIdAt: (sentence: any) => sentence.id
  });
  const safeTitle = state.session.title.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadText(`${safeTitle}.${timestamp}.review-report.md`, report, "text/markdown");
  els.workflowStatus.textContent = "Report downloaded.";
}

function downloadEditedDocument(): void {
  const ext = state.format === "latex" ? ".tex" : state.format === "markdown" ? ".md" : ".txt";
  const base = state.title.replace(/\.[^.]+$/, "") || "document";
  downloadText(`${base}.edited${ext}`, state.source, "text/plain");
  els.workflowStatus.textContent = "Edited document downloaded.";
}

async function applyCurrentEdit(): Promise<void> {
  els.editStatus.textContent = "saving...";
  try {
    const nextIndex = await applyEdit(state, index, els.editText.value);
    await persistReviewState(state);
    Object.keys(aiBySentence).forEach((key) => delete aiBySentence[key]);
    Object.keys(rewriteBySentence).forEach((key) => delete rewriteBySentence[key]);
    readSentenceId = null;
    lastAutoReadId = null;
    index = nextIndex;
    render();
    els.editStatus.textContent = "Saved and re-split.";
  } catch (error) {
    els.editStatus.textContent = error instanceof Error ? error.message : String(error);
  }
}

function revealSource(): void {
  const item = currentSentence();
  if (!Number.isInteger(item.sourceStart) || !Number.isInteger(item.sourceEnd)) {
    els.workflowStatus.textContent = "This sentence cannot be mapped back to a source range yet.";
    return;
  }
  const details = byId<HTMLDetailsElement>("sourcePreviewDetails");
  details.open = true;
  const preview = byId("sourcePreview");
  const before = escapeHtml(state.source.slice(0, item.sourceStart));
  const marked = escapeHtml(state.source.slice(item.sourceStart, item.sourceEnd));
  const after = escapeHtml(state.source.slice(item.sourceEnd));
  preview.innerHTML = `${before}<mark id="sourceMark">${marked}</mark>${after}`;
  document.getElementById("sourceMark")?.scrollIntoView({ block: "center" });
  els.workflowStatus.textContent = "Revealed in source preview.";
}

function updateContextToggle(): void {
  const collapsed = localStorage.getItem(CONTEXT_COLLAPSED_KEY) === "1";
  els.shell.classList.toggle("context-collapsed", collapsed);
  els.toggleContextBtn.textContent = collapsed ? "Show Context" : "Hide Context";
}

let bound = false;
function bindEvents(): void {
  if (bound) return;
  bound = true;

  document.querySelectorAll<HTMLButtonElement>("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => decide(button.dataset.decision!));
  });

  byId("prevBtn").addEventListener("click", () => moveWithinFilter(-1));
  byId("nextBtn").addEventListener("click", () => moveWithinFilter(1));
  els.speakBtn.addEventListener("click", toggleSpeech);
  byId<HTMLButtonElement>("aiBtn").addEventListener("click", () => {
    void askAi();
  });
  byId<HTMLButtonElement>("rewriteBtn").addEventListener("click", () => {
    void askRewrite();
  });
  els.applyEditBtn.addEventListener("click", () => {
    void applyCurrentEdit();
  });
  byId<HTMLButtonElement>("exportBtn").addEventListener("click", exportReport);
  byId<HTMLButtonElement>("downloadDocBtn").addEventListener("click", downloadEditedDocument);
  els.revealBtn.addEventListener("click", revealSource);

  els.toggleContextBtn.addEventListener("click", () => {
    const collapsed = els.shell.classList.contains("context-collapsed");
    if (collapsed) {
      localStorage.removeItem(CONTEXT_COLLAPSED_KEY);
    } else {
      localStorage.setItem(CONTEXT_COLLAPSED_KEY, "1");
    }
    updateContextToggle();
  });

  els.filter.addEventListener("change", () => {
    filter = els.filter.value;
    const indices = filteredIndices();
    if (indices.length && !indices.includes(index)) {
      index = indices[0];
    }
    render();
  });

  els.autoRead.addEventListener("change", () => {
    if (els.autoRead.checked) {
      lastAutoReadId = currentSentence().id;
      speak();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && event.target.tagName === "TEXTAREA") return;
    if (event.key === "ArrowLeft") moveWithinFilter(-1);
    if (event.key === "ArrowRight") moveWithinFilter(1);
    if (event.key.toLowerCase() === "a") decide("accepted");
    if (event.key.toLowerCase() === "r") decide("revise");
    if (event.key.toLowerCase() === "e") decide("repeated");
    if (event.key.toLowerCase() === "d") decide("delete");
    if (event.key.toLowerCase() === "u") decide("unsure");
    if (event.key === " " || event.key.toLowerCase() === "s") {
      event.preventDefault();
      toggleSpeech();
    }
  });
}

export function mountReviewUI(initialState: AppState): void {
  state = initialState;
  index = 0;
  filter = "all";
  Object.keys(aiBySentence).forEach((key) => delete aiBySentence[key]);
  Object.keys(rewriteBySentence).forEach((key) => delete rewriteBySentence[key]);
  readSentenceId = null;
  lastAutoReadId = null;
  speechPlaybackState = "idle";
  speakingForSentenceId = null;
  updateSpeakButtonLabel();
  updateContextToggle();
  bindEvents();
  render();
}
