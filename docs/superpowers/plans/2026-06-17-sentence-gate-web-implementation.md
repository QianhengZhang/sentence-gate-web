# Sentence Gate Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Sentence Gate VSCode extension's review experience into a standalone, dependency-light static web app deployable on GitHub Pages, with no backend.

**Architecture:** Vite + vanilla TypeScript. `packages/core` (pure sentence-analysis logic) is ported verbatim. VSCode-specific IO (file system, Secret Storage, webview messaging) is replaced by browser-native equivalents: File API for reading uploads, `Blob`/`download` for exports, `localStorage` for the OpenAI key, and IndexedDB for cross-session review/style-profile state.

**Tech Stack:** TypeScript, Vite, Vitest (+ `fake-indexeddb` for storage tests), no UI framework, GitHub Actions for Pages deployment.

**Spec:** `docs/superpowers/specs/2026-06-17-sentence-gate-web-design.md`

**Source repo for porting reference:** `/Users/josh/Documents/AcademicTexReader` (read-only reference; do not modify it)

---

### Task 1: Scaffold the Vite + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `index.html` (minimal placeholder, replaced fully in Task 7)
- Create: `src/main.ts` (minimal placeholder, replaced fully in Task 10)
- Create: `examples/sample-paper.tex` (copy)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sentence-gate-web",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  test: {
    environment: "node"
  }
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 5: Create a placeholder `index.html`** (full markup comes in Task 6)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sentence Gate</title>
</head>
<body>
  <div id="app">Loading…</div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Create a placeholder `src/main.ts`** (full content lands in Task 10)

```bash
mkdir -p src
```

```ts
console.log("Sentence Gate loading...");
```

- [ ] **Step 7: Copy the sample LaTeX file used for manual verification**

```bash
mkdir -p examples
cp /Users/josh/Documents/AcademicTexReader/examples/sample-paper.tex examples/sample-paper.tex
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 9: Verify the dev server boots**

Run: `npm run dev`, open the printed local URL.
Expected: a blank page with no console errors other than the "Sentence Gate
loading..." log line.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vite.config.ts .gitignore index.html src/main.ts examples/sample-paper.tex package-lock.json
git commit -m "Scaffold Vite + TypeScript project"
```

---

### Task 2: Port the core sentence-analysis engine

**Files:**
- Create: `src/core/index.ts`
- Create: `src/core/core.test.ts`

- [ ] **Step 1: Copy the original core module verbatim**

```bash
mkdir -p src/core
cp /Users/josh/Documents/AcademicTexReader/packages/core/index.js src/core/index.ts
```

- [ ] **Step 2: Convert CommonJS exports to ES module exports**

Open `src/core/index.ts`. Add the `export` keyword to each of these existing function
declarations (find each `function <name>(` line and prepend `export `):

`analyzeSentence`, `createReviewSession`, `createStyleProfile`,
`compareSentenceToStyle`, `extractSentenceRecords`, `extractTextSentenceRecords`,
`findRepetitionCandidates`, `normalizeLatexToText`, `splitSentences`,
`splitSentencesWithOffsets`.

For example:

```ts
function analyzeSentence(sentence) {
```
becomes
```ts
export function analyzeSentence(sentence) {
```

Then delete the trailing CommonJS export block at the end of the file:

```ts
module.exports = {
  analyzeSentence,
  createReviewSession,
  createStyleProfile,
  compareSentenceToStyle,
  extractSentenceRecords,
  extractTextSentenceRecords,
  findRepetitionCandidates,
  normalizeLatexToText,
  splitSentences,
  splitSentencesWithOffsets
};
```

- [ ] **Step 3: Port the smoke tests to Vitest**

Create `src/core/core.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests in `src/core/core.test.ts` pass (`7 passed` or similar).

- [ ] **Step 5: Commit**

```bash
git add src/core/index.ts src/core/core.test.ts
git commit -m "Port core sentence-analysis engine to TypeScript/ESM"
```

---

### Task 3: IndexedDB storage layer

**Files:**
- Create: `src/storage.ts`
- Create: `src/storage.test.ts`

- [ ] **Step 1: Write `src/storage.ts`**

```ts
const DB_NAME = "sentence-gate";
const DB_VERSION = 1;
const REVIEWS_STORE = "reviews";
const STYLE_PROFILES_STORE = "styleProfiles";
const SETTINGS_STORE = "settings";

export interface ReviewRecord {
  documentHash: string;
  title: string;
  format: string;
  sentenceCount: number;
  decisions: Record<string, unknown>;
  diagnosisCache: Record<string, unknown>;
  savedAt: string;
}

export interface StyleProfileRecord {
  id: string;
  [key: string]: unknown;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REVIEWS_STORE)) {
        db.createObjectStore(REVIEWS_STORE, { keyPath: "documentHash" });
      }
      if (!db.objectStoreNames.contains(STYLE_PROFILES_STORE)) {
        db.createObjectStore(STYLE_PROFILES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getReview(documentHash: string): Promise<ReviewRecord | undefined> {
  return withStore<ReviewRecord | undefined>(REVIEWS_STORE, "readonly", (store) =>
    store.get(documentHash)
  );
}

export async function saveReview(record: ReviewRecord): Promise<void> {
  await withStore<void>(REVIEWS_STORE, "readwrite", (store) => store.put(record));
}

export async function getActiveStyleProfile(): Promise<StyleProfileRecord | undefined> {
  return withStore<StyleProfileRecord | undefined>(STYLE_PROFILES_STORE, "readonly", (store) =>
    store.get("active")
  );
}

export async function saveStyleProfile(profile: Record<string, unknown>): Promise<void> {
  await withStore<void>(STYLE_PROFILES_STORE, "readwrite", (store) =>
    store.put({ ...profile, id: "active" })
  );
}

export async function clearStyleProfile(): Promise<void> {
  await withStore<void>(STYLE_PROFILES_STORE, "readwrite", (store) => store.delete("active"));
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const record = await withStore<{ key: string; value: T } | undefined>(
    SETTINGS_STORE,
    "readonly",
    (store) => store.get(key)
  );
  return record ? record.value : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await withStore<void>(SETTINGS_STORE, "readwrite", (store) => store.put({ key, value }));
}
```

- [ ] **Step 2: Write `src/storage.test.ts`** (uses `fake-indexeddb` so the test runs under Node)

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStyleProfile,
  getActiveStyleProfile,
  getReview,
  getSetting,
  saveReview,
  saveStyleProfile,
  setSetting,
  sha256Hex
} from "./storage";

beforeEach(async () => {
  // fresh fake-indexeddb database per test file run; each test uses unique keys
});

describe("storage", () => {
  it("hashes text deterministically", async () => {
    const a = await sha256Hex("hello world");
    const b = await sha256Hex("hello world");
    const c = await sha256Hex("different");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("round-trips a review record", async () => {
    const record = {
      documentHash: "test-hash-1",
      title: "Sample",
      format: "text",
      sentenceCount: 2,
      decisions: { "s-1": { status: "accepted", note: "", sentence: "x", updatedAt: "now" } },
      diagnosisCache: {},
      savedAt: "2026-06-17T00:00:00.000Z"
    };
    await saveReview(record);
    const loaded = await getReview("test-hash-1");
    expect(loaded).toEqual(record);
  });

  it("returns undefined for a missing review", async () => {
    const loaded = await getReview("does-not-exist");
    expect(loaded).toBeUndefined();
  });

  it("round-trips the active style profile", async () => {
    await saveStyleProfile({ title: "My style", sentenceCount: 10 });
    const loaded = await getActiveStyleProfile();
    expect(loaded?.title).toBe("My style");
    expect(loaded?.id).toBe("active");

    await clearStyleProfile();
    const cleared = await getActiveStyleProfile();
    expect(cleared).toBeUndefined();
  });

  it("round-trips settings", async () => {
    await setSetting("openaiModel", "gpt-5.5");
    const value = await getSetting<string>("openaiModel");
    expect(value).toBe("gpt-5.5");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all `src/storage.test.ts` tests pass alongside the Task 2 tests.

- [ ] **Step 4: Commit**

```bash
git add src/storage.ts src/storage.test.ts package.json package-lock.json
git commit -m "Add IndexedDB storage layer for reviews, style profiles, settings"
```

---

### Task 4: File reading, format detection, and export

**Files:**
- Create: `src/files.ts`
- Create: `src/files.test.ts`

- [ ] **Step 1: Write `src/files.ts`**

```ts
export type DocumentFormat = "latex" | "markdown" | "text";

export function determineFormat(fileName: string): DocumentFormat {
  const dot = fileName.lastIndexOf(".");
  const ext = dot === -1 ? "" : fileName.slice(dot).toLowerCase();
  if (ext === ".tex" || ext === ".ltx") {
    return "latex";
  }
  if (ext === ".md" || ext === ".markdown") {
    return "markdown";
  }
  return "text";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Write `src/files.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: `src/files.test.ts` tests pass. (`readFileAsText` and `downloadText` depend on
browser `FileReader`/`Blob`/DOM APIs and are exercised in the manual verification
pass in Task 16, not unit-tested here.)

- [ ] **Step 4: Commit**

```bash
git add src/files.ts src/files.test.ts
git commit -m "Add file reading, format detection, and export helpers"
```

---

### Task 5: OpenAI client (diagnosis + rewrite options)

**Files:**
- Create: `src/openai.ts`
- Create: `src/openai.test.ts`

- [ ] **Step 1: Write `src/openai.ts`**

```ts
import { sha256Hex } from "./storage";

const API_KEY_STORAGE_KEY = "sentenceGate.openaiApiKey";

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function diagnosisCacheKey(model: string, sentenceText: string): Promise<string> {
  return sha256Hex(`diagnosis\n${model}\n${sentenceText}`);
}

export function rewriteCacheKey(model: string, sentenceText: string): Promise<string> {
  return sha256Hex(`rewrite\n${model}\n${sentenceText}`);
}

export function extractOutputText(body: any): string {
  if (typeof body.output_text === "string") {
    return body.output_text;
  }
  const chunks: string[] = [];
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export interface DiagnosisSentenceInput {
  text: string;
  section: string;
  paragraphIndex: number;
  index: number;
  wordCount: number;
  adverbs: string[];
  punctuation: Record<string, number>;
  rareWordCandidates: string[];
  aiLikePhrases: string[];
  styleComparison: unknown;
}

export interface DiagnosisPayload {
  model: string;
  sentence: DiagnosisSentenceInput;
  previous: string[];
  next: string[];
  repetitionCandidates: unknown[];
  styleProfile: unknown;
}

async function postToResponsesApi(model: string, systemText: string, userPayload: unknown, schemaName: string, schema: unknown): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No OpenAI API key configured. Set it in Settings first.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemText }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(userPayload) }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error && body.error.message ? body.error.message : `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI returned no text output.");
  }
  return JSON.parse(outputText);
}

export function diagnoseSentence(payload: DiagnosisPayload): Promise<any> {
  const systemText = [
    "You are Sentence Gate, a diagnostic assistant for human-in-the-loop academic writing review.",
    "Do not rewrite the sentence unless explicitly asked. Diagnose only.",
    "The human author must make the final decision.",
    "Be concrete, restrained, and useful for sentence-level academic review."
  ].join(" ");

  const userPayload = {
    current_sentence: payload.sentence.text,
    current_location: {
      section: payload.sentence.section,
      paragraph_index: payload.sentence.paragraphIndex,
      sentence_index: payload.sentence.index
    },
    local_signals: {
      word_count: payload.sentence.wordCount,
      adverbs: payload.sentence.adverbs,
      punctuation: payload.sentence.punctuation,
      rare_word_candidates: payload.sentence.rareWordCandidates,
      ai_like_phrases: payload.sentence.aiLikePhrases
    },
    previous_context: payload.previous,
    next_context: payload.next,
    broad_repetition_candidates: payload.repetitionCandidates,
    style_profile_summary: payload.styleProfile || null,
    style_comparison: payload.sentence.styleComparison || null,
    task: [
      "Return a concise JSON diagnosis.",
      "Focus on naturalness, clarity, style risk, and whether the human should manually revise.",
      "For repetition_risk, prioritize echoes across paragraphs or sections using broad_repetition_candidates.",
      "For style_note, compare against style_profile_summary and style_comparison when provided.",
      "Do not treat ordinary local cohesion with adjacent sentences as a repetition problem unless it is genuinely redundant."
    ].join(" ")
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      clarity: { type: "string", enum: ["good", "medium", "weak"] },
      naturalness: { type: "string", enum: ["good", "medium", "awkward"] },
      too_ai_like: { type: "boolean" },
      rewrite_needed: { type: "boolean" },
      main_concern: { type: "string" },
      suspicious_words: { type: "array", items: { type: "string" } },
      repetition_risk: { type: "string" },
      style_note: { type: "string" },
      human_action: {
        type: "string",
        enum: ["accept", "revise_manually", "check_repetition", "delete_or_merge", "unsure"]
      }
    },
    required: [
      "clarity", "naturalness", "too_ai_like", "rewrite_needed", "main_concern",
      "suspicious_words", "repetition_risk", "style_note", "human_action"
    ]
  };

  return postToResponsesApi(payload.model, systemText, userPayload, "sentence_gate_diagnosis", schema);
}

export interface RewritePayload {
  model: string;
  sentence: { text: string; styleComparison: unknown };
  previous: string[];
  next: string[];
  styleProfile: unknown;
}

export function suggestRewriteOptions(payload: RewritePayload): Promise<any> {
  const systemText = [
    "You are Sentence Gate, a restrained revision assistant for academic writing.",
    "Return rewrite options only. Do not claim that any rewrite has been applied.",
    "The human author will decide whether to use, edit, or reject the options.",
    "Preserve the author's meaning and avoid adding new claims."
  ].join(" ");

  const userPayload = {
    current_sentence: payload.sentence.text,
    previous_context: payload.previous,
    next_context: payload.next,
    style_profile_summary: payload.styleProfile || null,
    style_comparison: payload.sentence.styleComparison || null,
    task: [
      "Provide two rewrite options.",
      "minimal_edit should preserve structure and change as little as possible.",
      "natural_academic should improve clarity and flow while remaining concise.",
      "Do not split into multiple sentences unless the original is genuinely overloaded."
    ].join(" ")
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      minimal_edit: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" }, rationale: { type: "string" } },
        required: ["text", "rationale"]
      },
      natural_academic: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" }, rationale: { type: "string" } },
        required: ["text", "rationale"]
      },
      caution: { type: "string" }
    },
    required: ["minimal_edit", "natural_academic", "caution"]
  };

  return postToResponsesApi(payload.model, systemText, userPayload, "sentence_gate_rewrite_options", schema);
}
```

- [ ] **Step 2: Write `src/openai.test.ts`** (covers the pure helpers; the two network
functions are exercised manually in Task 16 since they require a real API key)

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { clearApiKey, diagnosisCacheKey, extractOutputText, getApiKey, rewriteCacheKey, setApiKey } from "./openai";

beforeEach(() => {
  localStorage.clear();
});

describe("openai key storage", () => {
  it("stores, reads, and clears the API key", () => {
    expect(getApiKey()).toBeNull();
    setApiKey("  sk-test-123  ");
    expect(getApiKey()).toBe("sk-test-123");
    clearApiKey();
    expect(getApiKey()).toBeNull();
  });
});

describe("cache keys", () => {
  it("produces stable, distinct hashes per kind/model/sentence", async () => {
    const a = await diagnosisCacheKey("gpt-5.5", "The cat sat.");
    const b = await diagnosisCacheKey("gpt-5.5", "The cat sat.");
    const c = await rewriteCacheKey("gpt-5.5", "The cat sat.");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("extractOutputText", () => {
  it("prefers output_text when present", () => {
    expect(extractOutputText({ output_text: "hello" })).toBe("hello");
  });

  it("falls back to concatenating output[].content[].text", () => {
    const body = {
      output: [
        { content: [{ text: "part one" }] },
        { content: [{ text: "part two" }] }
      ]
    };
    expect(extractOutputText(body)).toBe("part one\npart two");
  });

  it("returns an empty string when nothing is found", () => {
    expect(extractOutputText({})).toBe("");
  });
});
```

- [ ] **Step 3: Configure Vitest to run in a browser-like environment**

`localStorage` and `crypto.subtle` must be available in tests. Edit `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  test: {
    environment: "happy-dom"
  }
});
```

Add `happy-dom` as a dev dependency in `package.json`'s `devDependencies`:

```json
"happy-dom": "^15.7.4",
```

Run: `npm install`

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all tests across `src/core`, `src/storage.test.ts`, `src/files.test.ts`,
and `src/openai.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/openai.ts src/openai.test.ts vite.config.ts package.json package-lock.json
git commit -m "Add OpenAI client for sentence diagnosis and rewrite options"
```

---

### Task 6: Review report generator

**Files:**
- Create: `src/report.ts`
- Create: `src/report.test.ts`

This ports `buildReviewReport` from `apps/vscode/extension.js:405-480`. The original
took a VSCode `document` to compute `sourceLocation`; the web version takes a plain
`sourceTitle` string instead (there is no live editor to resolve a line number
against, so the report only cites the section, not a file:line).

- [ ] **Step 1: Write `src/report.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/report.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: `src/report.test.ts` tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/report.ts src/report.test.ts
git commit -m "Port review report generator"
```

---

### Task 7: index.html shell — load screen, settings, review screen containers

**Files:**
- Modify: `index.html` (replace the placeholder from Task 1 entirely)

This ports the visual design of the webview (`apps/vscode/extension.js:969-1407` for
markup/CSS) and adds three new top-level screens the extension didn't need because
VSCode supplied the open file, the secret storage, and the workspace folder picker:
a **load screen** (open file / paste / drag-and-drop), a **settings panel**
(API key, model, style profile), and the existing **review screen**.

- [ ] **Step 1: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentence Gate</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #1a1a1a;
      --muted: #6b7280;
      --border: #d1d5db;
      --button: #2563eb;
      --button-fg: #ffffff;
      --secondary: #e5e7eb;
      --secondary-fg: #111827;
      --accent: #2563eb;
      --warn: #b45309;
      --error: #b91c1c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1e1e1e;
        --fg: #e5e5e5;
        --muted: #9ca3af;
        --border: #3f3f46;
        --button: #3b82f6;
        --button-fg: #0b1220;
        --secondary: #2d2d30;
        --secondary-fg: #e5e5e5;
        --accent: #60a5fa;
        --warn: #f59e0b;
        --error: #f87171;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    button {
      min-height: 32px;
      border: 0;
      border-radius: 4px;
      padding: 6px 11px;
      background: var(--secondary);
      color: var(--secondary-fg);
      cursor: pointer;
      font: inherit;
    }
    button.primary { background: var(--button); color: var(--button-fg); }
    button:focus { outline: 1px solid var(--accent); outline-offset: 2px; }
    textarea, input[type="text"], input[type="password"], select {
      width: 100%;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--fg);
      padding: 8px;
      font: inherit;
      border-radius: 4px;
    }
    .screen { display: none; padding: 22px; max-width: 1200px; margin: 0 auto; }
    .screen.active { display: block; }
    .kicker { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
    .dropzone {
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 48px 24px;
      text-align: center;
      color: var(--muted);
      margin-bottom: 20px;
    }
    .dropzone.dragover { border-color: var(--accent); color: var(--fg); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .panel { display: grid; gap: 10px; align-content: start; }
    .metric { border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    .metric strong { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    details { border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    summary { cursor: pointer; color: var(--muted); font-size: 12px; margin-bottom: 10px; }
    .status-pill {
      display: inline-block;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-size: 12px;
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(140px, 0.45fr) minmax(420px, 1.9fr) minmax(220px, 0.75fr);
      min-height: 100vh;
    }
    aside, main { padding: 22px; border-right: 1px solid var(--border); }
    aside:last-child { border-right: 0; }
    .context { display: grid; gap: 16px; align-content: center; min-height: calc(100vh - 44px); }
    .context-sentence { color: var(--muted); line-height: 1.5; font-size: 12px; }
    .current-marker { border-left: 3px solid var(--accent); padding-left: 12px; line-height: 1.5; font-size: 13px; }
    main { display: grid; grid-template-rows: auto 1fr auto; gap: 20px; min-width: 0; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
    .progress { width: 100%; height: 6px; border: 1px solid var(--border); background: transparent; }
    .progress > div { height: 100%; background: var(--accent); width: 0; }
    .filterbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
    .toggles { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .toggles label { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .sentence-wrap { display: grid; align-content: center; min-height: 420px; }
    .sentence { font-size: 34px; line-height: 1.48; max-width: 960px; }
    .mark-adverb { color: var(--warn); border-bottom: 2px solid var(--warn); }
    .mark-punctuation { color: var(--error); font-weight: 700; }
    textarea.editor { min-height: 96px; line-height: 1.45; }
    .ai-box { border: 1px solid var(--border); border-radius: 6px; padding: 12px; display: grid; gap: 8px; }
    .rewrite-option { display: grid; gap: 6px; border-top: 1px solid var(--border); padding-top: 10px; margin-top: 10px; }
    .source-preview { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.6; max-height: 240px; overflow: auto; border: 1px solid var(--border); border-radius: 6px; padding: 10px; }
    .source-preview mark { background: var(--accent); color: var(--bg); }

    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      aside, main { border-right: 0; border-bottom: 1px solid var(--border); }
      .context { min-height: auto; }
      .sentence { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div id="loadScreen" class="screen active">
    <h1>Sentence Gate</h1>
    <p class="kicker">Human-in-the-loop sentence review for AI-assisted academic writing. Everything runs in this browser tab — nothing is uploaded anywhere except direct calls you trigger to OpenAI.</p>
    <div id="dropzone" class="dropzone">Drop a .tex / .md / .markdown / .txt file here, or use the buttons below.</div>
    <div class="actions">
      <button id="chooseFileBtn" class="primary">Choose File…</button>
      <input id="fileInput" type="file" accept=".tex,.ltx,.md,.markdown,.txt" style="display:none">
      <button id="openSettingsFromLoadBtn">Settings</button>
    </div>
    <details style="margin-top: 20px;">
      <summary>Or paste text to review</summary>
      <textarea id="pasteText" placeholder="Paste text here" style="min-height: 160px;"></textarea>
      <div class="actions" style="margin-top: 8px;">
        <button id="reviewPasteBtn" class="primary">Review Pasted Text</button>
      </div>
    </details>
    <p id="loadStatus" class="status-pill"></p>
  </div>

  <div id="settingsScreen" class="screen">
    <h1>Settings</h1>
    <div class="panel" style="max-width: 560px;">
      <div class="metric">
        <strong>OpenAI API Key</strong>
        <input id="apiKeyInput" type="password" placeholder="sk-...">
        <div class="actions" style="margin-top: 8px;">
          <button id="saveApiKeyBtn" class="primary">Save Key</button>
          <button id="clearApiKeyBtn">Clear Key</button>
          <span id="apiKeyStatus" class="status-pill"></span>
        </div>
        <p class="kicker">Stored only in this browser's localStorage. Requests go straight from this page to OpenAI — do not use this on a shared or public computer.</p>
      </div>
      <div class="metric">
        <strong>Model</strong>
        <input id="modelInput" type="text" value="gpt-5.5">
      </div>
      <div class="metric">
        <strong>Context sentences sent to AI calls</strong>
        <input id="maxContextInput" type="text" value="1">
      </div>
      <div class="metric">
        <strong>Style Profile</strong>
        <p id="styleProfileSummary" class="kicker">No style profile loaded.</p>
        <input id="styleFilesInput" type="file" multiple webkitdirectory style="display:none">
        <div class="actions">
          <button id="buildStyleProfileBtn">Build From Files/Folder…</button>
          <button id="exportStyleProfileBtn">Export JSON</button>
          <input id="importStyleProfileInput" type="file" accept="application/json" style="display:none">
          <button id="importStyleProfileBtn">Import JSON</button>
          <button id="clearStyleProfileBtn">Clear</button>
        </div>
      </div>
      <div class="actions">
        <button id="backToLoadBtn" class="primary">Back</button>
      </div>
    </div>
  </div>

  <div id="reviewScreen" class="screen">
    <div class="shell">
      <aside class="context">
        <div>
          <div class="kicker">Previous</div>
          <div id="previous" class="context-sentence"></div>
        </div>
        <div>
          <div class="kicker">Current</div>
          <div id="currentMini" class="current-marker"></div>
        </div>
        <div>
          <div class="kicker">Next</div>
          <div id="next" class="context-sentence"></div>
        </div>
      </aside>

      <main>
        <div class="topbar">
          <span id="counter"></span>
          <span id="location"></span>
          <span id="status" class="status-pill">unreviewed</span>
        </div>
        <div class="progress" aria-hidden="true"><div id="progress"></div></div>
        <div class="filterbar">
          <label>
            Filter
            <select id="filter">
              <option value="all">All sentences</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="accepted">Accepted</option>
              <option value="revise">Revise</option>
              <option value="repeated">Repeated</option>
              <option value="delete">Delete</option>
              <option value="unsure">Unsure</option>
            </select>
          </label>
          <div class="toggles">
            <label><input id="autoRead" type="checkbox"> Auto Read</label>
            <label><input id="requireRead" type="checkbox"> Require Read Before Accept</label>
            <span id="readStatus" class="status-pill">not read</span>
          </div>
          <span id="filterCount"></span>
        </div>
        <div class="sentence-wrap"><div id="sentence" class="sentence"></div></div>
        <div>
          <div class="actions" style="margin-top: 10px;">
            <button class="primary" data-decision="accepted">Accept</button>
            <button data-decision="revise">Revise</button>
            <button data-decision="repeated">Repeated</button>
            <button data-decision="unsure">Unsure</button>
            <button id="prevBtn" title="Previous sentence">Previous</button>
            <button id="nextBtn" title="Next sentence">Next</button>
            <button id="speakBtn" title="Read current sentence aloud">Read Aloud</button>
            <span id="workflowStatus" class="status-pill"></span>
          </div>
          <details>
            <summary>Edit And Notes</summary>
            <div class="kicker">Edit Current Sentence</div>
            <textarea id="editText" class="editor"></textarea>
            <div class="actions" style="margin-top: 8px; margin-bottom: 14px;">
              <button id="applyEditBtn" class="primary">Apply Edit</button>
              <button data-decision="delete">Delete</button>
              <span id="editStatus" class="status-pill"></span>
            </div>
            <textarea id="note" placeholder="Optional note for yourself"></textarea>
          </details>
          <details>
            <summary>AI And Tools</summary>
            <div class="actions">
              <button id="aiBtn" title="Ask for AI diagnosis">AI Diagnosis</button>
              <button id="rewriteBtn" title="Ask for rewrite options">Rewrite Options</button>
              <button id="revealBtn" title="Show current sentence in source preview">Reveal Source</button>
              <button id="exportBtn" title="Export review report">Export Report</button>
              <button id="downloadDocBtn" title="Download the edited document">Download Edited Document</button>
              <button id="openSettingsFromReviewBtn">Settings</button>
              <button id="backToLoadFromReviewBtn">Open Different File</button>
            </div>
          </details>
          <details id="sourcePreviewDetails">
            <summary>Source Preview</summary>
            <div id="sourcePreview" class="source-preview"></div>
          </details>
        </div>
      </main>

      <aside class="panel">
        <div class="metric"><strong>Review Progress</strong><span id="reviewProgress"></span></div>
        <div class="metric"><strong>Status Counts</strong><span id="statusCounts"></span></div>
        <div class="metric"><strong>Section Progress</strong><span id="sectionProgress"></span></div>
        <div class="metric"><strong>Length</strong><span id="length"></span></div>
        <div class="metric"><strong>Adverbs</strong><span id="adverbs"></span></div>
        <div class="metric"><strong>Special Punctuation</strong><span id="punctuation"></span></div>
        <details>
          <summary>Analysis</summary>
          <div class="metric"><strong>Style Baseline</strong><span id="styleBaseline"></span></div>
          <div class="metric"><strong>Style Comparison</strong><span id="styleComparison"></span></div>
          <div class="metric"><strong>Rare Word Candidates</strong><span id="rare"></span></div>
          <div class="metric"><strong>AI-like Phrases</strong><span id="phrases"></span></div>
          <div class="metric"><strong>Document Echo Candidates</strong><span id="echo"></span></div>
        </details>
        <details>
          <summary>AI Output</summary>
          <div class="ai-box"><strong>AI Diagnosis</strong><div id="aiResult">Not requested.</div></div>
          <div class="ai-box"><strong>Rewrite Options</strong><div id="rewriteResult">Not requested.</div></div>
        </details>
      </aside>
    </div>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the project still builds**

Run: `npm run build`
Expected: succeeds (it will currently fail to resolve `/src/main.ts` meaningfully
since `main.ts` is still the Task 1 placeholder — that's fine, confirm the error is
only about missing exports/usage in `main.ts`, not an HTML/CSS parse error).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Build full page shell: load, settings, and review screens"
```

---

### Task 8: App state, document loading, and review-state persistence

**Files:**
- Create: `src/app-state.ts`
- Modify: `src/main.ts`

This ports the load-time logic of `startReview` / `reviewClipboard` /
`startReviewSession` (`apps/vscode/extension.js:22-53,121-139`), replacing the
VSCode document/clipboard inputs with file upload, drag-and-drop, and a paste
textarea, and replacing the `.sentence-gate/reviews/*.json` state file with the
IndexedDB `reviews` store keyed by document hash (Task 3).

- [ ] **Step 1: Write `src/app-state.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/app-state.test.ts`**

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { loadDocument, persistReviewState } from "./app-state";

beforeEach(() => {
  localStorage.clear();
});

describe("loadDocument", () => {
  it("builds a fresh session with no prior decisions", async () => {
    const state = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    expect(state.session.sentenceCount).toBe(2);
    expect(state.decisions).toEqual({});
  });

  it("restores decisions saved for the same document content", async () => {
    const first = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    first.decisions[first.session.sentences[0].id] = { status: "accepted", note: "", sentence: "x", updatedAt: "now" };
    await persistReviewState(first);

    const second = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    expect(second.decisions[second.session.sentences[0].id].status).toBe("accepted");
  });

  it("treats different content as a different document", async () => {
    const first = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    first.decisions[first.session.sentences[0].id] = { status: "accepted", note: "", sentence: "x", updatedAt: "now" };
    await persistReviewState(first);

    const different = await loadDocument("A totally different sentence here.", "draft.txt", "text");
    expect(different.decisions).toEqual({});
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: `src/app-state.test.ts` tests pass.

- [ ] **Step 4: Wire `src/main.ts`** to the load screen (file picker, drag-and-drop,
paste). This calls into `ui.ts`, written in Task 9 — for now, stub the review-screen
hookup with a `console.log` so this task is independently testable; Task 9 replaces
the stub.

```ts
import { determineFormat, readFileAsText } from "./files";
import { loadDocument } from "./app-state";

const loadScreen = document.getElementById("loadScreen")!;
const dropzone = document.getElementById("dropzone")!;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const chooseFileBtn = document.getElementById("chooseFileBtn")!;
const pasteText = document.getElementById("pasteText") as HTMLTextAreaElement;
const reviewPasteBtn = document.getElementById("reviewPasteBtn")!;
const loadStatus = document.getElementById("loadStatus")!;

async function startReviewFromSource(source: string, title: string): Promise<void> {
  if (!source.trim()) {
    loadStatus.textContent = "Nothing to review — the document is empty.";
    return;
  }
  const format = determineFormat(title);
  const state = await loadDocument(source, title, format);
  if (state.session.sentenceCount === 0) {
    loadStatus.textContent = "Sentence Gate could not find reviewable sentences in this text.";
    return;
  }
  console.log("Loaded session (ui.ts wiring lands in Task 9):", state);
}

chooseFileBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const text = await readFileAsText(file);
  await startReviewFromSource(text, file.name);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const text = await readFileAsText(file);
  await startReviewFromSource(text, file.name);
});

reviewPasteBtn.addEventListener("click", async () => {
  await startReviewFromSource(pasteText.value, "Pasted text");
});

void loadScreen;
```

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the printed local URL, drop `examples/sample-paper.tex`
into the dropzone.
Expected: the browser devtools console logs `Loaded session...` with a session
object whose `sentenceCount` is greater than 0.

- [ ] **Step 6: Commit**

```bash
git add src/app-state.ts src/app-state.test.ts src/main.ts
git commit -m "Wire document loading (upload/drag-drop/paste) to review state"
```

---

### Task 9: Pure render-helper functions

**Files:**
- Create: `src/render-helpers.ts`
- Create: `src/render-helpers.test.ts`

Extracted from the webview's inline script (`apps/vscode/extension.js:1549-1660`) so
they're unit-testable without a DOM. `ui.ts` (Task 10) imports these.

- [ ] **Step 1: Write `src/render-helpers.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/render-helpers.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: `src/render-helpers.test.ts` tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/render-helpers.ts src/render-helpers.test.ts
git commit -m "Add pure render-helper functions for the review screen"
```

---

### Task 10: Review screen — render, navigation, decide, keyboard shortcuts

**Files:**
- Create: `src/ui.ts`
- Modify: `src/main.ts`

Ports the bulk of the webview's inline script (`apps/vscode/extension.js:1410-1860,
1947-1979`). AI buttons, edit/export/download buttons, and the source-preview
"reveal" behavior are deliberately left unwired here — `render()` already reflects
their disabled/enabled state, but their `click` handlers are added in Tasks
11-13 by editing this same file. This task covers: rendering the current sentence,
Accept/Revise/Repeated/Unsure/Delete decisions, Previous/Next + filter navigation,
auto-read/require-read toggles, and keyboard shortcuts.

- [ ] **Step 1: Write `src/ui.ts`**

```ts
import type { AppState } from "./app-state";
import { persistReviewState } from "./app-state";
import {
  echoSummary,
  escapeHtml,
  highlight,
  list,
  punctuationSummary,
  styleBaselineSummary,
  styleComparisonSummary
} from "./render-helpers";

interface Decision {
  status: string;
  note: string;
  sentence: string;
  updatedAt: string;
}

let state: AppState;
let index = 0;
let filter = "all";
const aiBySentence: Record<string, any> = {};
const rewriteBySentence: Record<string, any> = {};
let readSentenceId: string | null = null;
let lastAutoReadId: string | null = null;

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
  workflowStatus: byId("workflowStatus")
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
  utterance.onend = () => markRead(speakingSentenceId);
  utterance.onerror = () => markRead(speakingSentenceId);
  window.speechSynthesis.speak(utterance);
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
  byId("speakBtn").addEventListener("click", speak);

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
      speak();
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
  bindEvents();
  render();
}
```

- [ ] **Step 2: Wire screen switching and mount the review UI in `src/main.ts`**

Replace the `startReviewFromSource` function body's `console.log(...)` line, and add
screen-switching helpers and the settings/back navigation buttons that exist in the
DOM from Task 7 but aren't wired yet:

```ts
import { determineFormat, readFileAsText } from "./files";
import { loadDocument } from "./app-state";
import { mountReviewUI } from "./ui";

const loadScreen = document.getElementById("loadScreen")!;
const settingsScreen = document.getElementById("settingsScreen")!;
const reviewScreen = document.getElementById("reviewScreen")!;
const dropzone = document.getElementById("dropzone")!;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const chooseFileBtn = document.getElementById("chooseFileBtn")!;
const pasteText = document.getElementById("pasteText") as HTMLTextAreaElement;
const reviewPasteBtn = document.getElementById("reviewPasteBtn")!;
const loadStatus = document.getElementById("loadStatus")!;

function showScreen(screen: HTMLElement): void {
  [loadScreen, settingsScreen, reviewScreen].forEach((s) => s.classList.remove("active"));
  screen.classList.add("active");
}

async function startReviewFromSource(source: string, title: string): Promise<void> {
  if (!source.trim()) {
    loadStatus.textContent = "Nothing to review — the document is empty.";
    return;
  }
  const format = determineFormat(title);
  const state = await loadDocument(source, title, format);
  if (state.session.sentenceCount === 0) {
    loadStatus.textContent = "Sentence Gate could not find reviewable sentences in this text.";
    return;
  }
  loadStatus.textContent = "";
  showScreen(reviewScreen);
  mountReviewUI(state);
}

chooseFileBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const text = await readFileAsText(file);
  await startReviewFromSource(text, file.name);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const text = await readFileAsText(file);
  await startReviewFromSource(text, file.name);
});

reviewPasteBtn.addEventListener("click", async () => {
  await startReviewFromSource(pasteText.value, "Pasted text");
});

document.getElementById("openSettingsFromLoadBtn")!.addEventListener("click", () => showScreen(settingsScreen));
document.getElementById("openSettingsFromReviewBtn")!.addEventListener("click", () => showScreen(settingsScreen));
document.getElementById("backToLoadBtn")!.addEventListener("click", () => showScreen(loadScreen));
document.getElementById("backToLoadFromReviewBtn")!.addEventListener("click", () => showScreen(loadScreen));
```

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open the local URL, drop in `examples/sample-paper.tex`.
Expected: the review screen appears showing the first sentence; `Accept`/`Revise`/
arrow keys/`Read Aloud` all work; the filter dropdown narrows the sentence list;
"Open Different File" returns to the load screen.

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts src/main.ts
git commit -m "Wire review screen: render, navigation, decisions, keyboard shortcuts"
```

---

### Task 11: AI Diagnosis and Rewrite Options wiring

**Files:**
- Modify: `src/ui.ts` (extends the file created in Task 10)

Ports the `askAi` / `askRewrite` message handlers (`apps/vscode/extension.js:
246-337`). The cache that was keyed inside the VSCode review-state file now lives in
`state.diagnosisCache` (already part of `AppState`/`ReviewRecord` from Task 3/8) —
no schema change needed, just populate it.

- [ ] **Step 1: Add imports**

At the top of `src/ui.ts`, add to the existing imports:

```ts
import { diagnoseSentence, diagnosisCacheKey, rewriteCacheKey, suggestRewriteOptions } from "./openai";
import { getSetting } from "./storage";
```

- [ ] **Step 2: Add `askAi` and `askRewrite` functions**

Insert these just above the `let bound = false;` line in `src/ui.ts`:

```ts
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
```

- [ ] **Step 3: Wire the buttons**

Inside `bindEvents()` in `src/ui.ts`, add after the `speakBtn` listener line:

```ts
  byId<HTMLButtonElement>("aiBtn").addEventListener("click", () => {
    void askAi();
  });
  byId<HTMLButtonElement>("rewriteBtn").addEventListener("click", () => {
    void askRewrite();
  });
```

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`. In Settings (Task 12 will make this screen functional — for now
this step only confirms wiring doesn't throw), open the review screen and click
`AI Diagnosis` without an API key set.
Expected: the AI Output panel shows the error text `"No OpenAI API key configured.
Set it in Settings first."` instead of a thrown exception in the console.

- [ ] **Step 5: Commit**

```bash
git add src/ui.ts
git commit -m "Wire AI Diagnosis and Rewrite Options buttons"
```

---

### Task 12: Apply Edit, Export Report, Download Edited Document

**Files:**
- Modify: `src/app-state.ts` (add edit/re-split logic)
- Modify: `src/app-state.test.ts` (add tests for the new logic)
- Modify: `src/ui.ts` (wire the buttons)

Ports `replaceSourceSentence`, `remapDecisions`, `indexAfterEdit`, and
`applySentenceEdit` (`apps/vscode/extension.js:515-624`) into `app-state.ts`, and
`buildReviewReport`'s call site plus the new "download edited document" feature
into `ui.ts`. Because review records are keyed by document content hash (Task 3),
an edit changes the document's identity for persistence purposes — `applyEdit`
recomputes `state.documentHash` after splicing in the replacement text.

- [ ] **Step 1: Add edit/re-split functions to `src/app-state.ts`**

Add these exports (they use `buildSession`, already defined earlier in the file):

```ts
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
```

- [ ] **Step 2: Add tests to `src/app-state.test.ts`**

Append to the `describe("loadDocument", ...)` block's file (new top-level
`describe`):

```ts
import { applyEdit } from "./app-state";
```

(merge into the existing `import { loadDocument, persistReviewState } from
"./app-state";` line instead of a separate line)

```ts
describe("applyEdit", () => {
  it("splices the replacement into the source and re-splits sentences", async () => {
    const state = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    const nextIndex = await applyEdit(state, 0, "First sentence, rewritten.");
    expect(state.source).toBe("First sentence, rewritten. Second sentence.");
    expect(state.session.sentences[0].text).toBe("First sentence, rewritten.");
    expect(nextIndex).toBe(0);
  });

  it("carries forward decisions for unchanged sentences", async () => {
    const state = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    const secondId = state.session.sentences[1].id;
    state.decisions[secondId] = { status: "accepted", note: "", sentence: "Second sentence.", updatedAt: "now" };

    await applyEdit(state, 0, "First sentence, rewritten.");

    const newSecondId = state.session.sentences[1].id;
    expect(state.decisions[newSecondId].status).toBe("accepted");
  });

  it("throws when the sentence is not editable", async () => {
    const state = await loadDocument("First sentence. Second sentence.", "draft.txt", "text");
    state.session.sentences[0].editable = false;
    await expect(applyEdit(state, 0, "Replacement.")).rejects.toThrow(/cannot be safely mapped/);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: the new `applyEdit` tests pass alongside everything else.

- [ ] **Step 4: Wire Apply Edit, Export Report, and Download Edited Document in `src/ui.ts`**

Add to the imports at the top:

```ts
import { applyEdit, persistReviewState } from "./app-state";
import { buildReviewReport } from "./report";
import { downloadText } from "./files";
```

(merge `applyEdit` into the existing `import { persistReviewState } from
"./app-state";` line)

Add these functions just above `let bound = false;`:

```ts
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
```

Inside `bindEvents()`, add after the `rewriteBtn` listener:

```ts
  els.applyEditBtn.addEventListener("click", () => {
    void applyCurrentEdit();
  });
  byId<HTMLButtonElement>("exportBtn").addEventListener("click", exportReport);
  byId<HTMLButtonElement>("downloadDocBtn").addEventListener("click", downloadEditedDocument);
```

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open `examples/sample-paper.tex`, edit the current sentence's
text in the "Edit Current Sentence" box, click `Apply Edit`.
Expected: the sentence list re-splits, `Edit Status` shows "Saved and re-split.",
and `Export Report` / `Download Edited Document` each trigger a file download.

- [ ] **Step 6: Commit**

```bash
git add src/app-state.ts src/app-state.test.ts src/ui.ts
git commit -m "Wire sentence editing, report export, and document download"
```

---

### Task 13: Settings screen — API key, model, style profile

**Files:**
- Create: `src/settings.ts`
- Modify: `src/main.ts`

Ports `setApiKey` / `clearApiKey` / `buildStyleProfileCommand` /
`collectStyleDocuments` (`apps/vscode/extension.js:55-119,626-645`) into the
settings screen built in Task 7. File-system folder scanning becomes a
multi-file/folder `<input>` selection (already in `index.html` as
`styleFilesInput`); `.sentence-gate/style-profile.json` becomes the IndexedDB
`styleProfiles` store (Task 3) plus optional JSON export/import for portability.

This file is DOM/File-API/IndexedDB wiring with no pure logic worth isolating
(consistent with `ui.ts` — verified manually rather than unit tested, since the
codebase's existing test coverage convention only unit-tests pure functions in
`core/`, `storage`, `files`, `openai`, and `report`).

- [ ] **Step 1: Write `src/settings.ts`**

```ts
import { createStyleProfile } from "./core/index";
import { clearApiKey, getApiKey, setApiKey } from "./openai";
import { clearStyleProfile, getActiveStyleProfile, getSetting, saveStyleProfile, setSetting } from "./storage";
import { determineFormat, downloadText, readFileAsText } from "./files";
import { styleBaselineSummary } from "./render-helpers";

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const els = {
  apiKeyInput: byId<HTMLInputElement>("apiKeyInput"),
  saveApiKeyBtn: byId<HTMLButtonElement>("saveApiKeyBtn"),
  clearApiKeyBtn: byId<HTMLButtonElement>("clearApiKeyBtn"),
  apiKeyStatus: byId("apiKeyStatus"),
  modelInput: byId<HTMLInputElement>("modelInput"),
  maxContextInput: byId<HTMLInputElement>("maxContextInput"),
  styleProfileSummary: byId("styleProfileSummary"),
  styleFilesInput: byId<HTMLInputElement>("styleFilesInput"),
  buildStyleProfileBtn: byId<HTMLButtonElement>("buildStyleProfileBtn"),
  exportStyleProfileBtn: byId<HTMLButtonElement>("exportStyleProfileBtn"),
  importStyleProfileInput: byId<HTMLInputElement>("importStyleProfileInput"),
  importStyleProfileBtn: byId<HTMLButtonElement>("importStyleProfileBtn"),
  clearStyleProfileBtn: byId<HTMLButtonElement>("clearStyleProfileBtn")
};

const ALLOWED_STYLE_EXTENSIONS = [".tex", ".ltx", ".md", ".markdown", ".txt"];

async function refreshStyleProfileSummary(): Promise<void> {
  const profile = await getActiveStyleProfile();
  els.styleProfileSummary.innerHTML = profile ? styleBaselineSummary(profile as any) : "No style profile loaded.";
}

async function loadSettingsIntoForm(): Promise<void> {
  els.apiKeyInput.value = "";
  els.apiKeyStatus.textContent = getApiKey() ? "Key is set." : "No key set.";
  els.modelInput.value = (await getSetting<string>("openaiModel")) || "gpt-5.5";
  els.maxContextInput.value = String((await getSetting<number>("maxContextSentences")) ?? 1);
  await refreshStyleProfileSummary();
}

function bindSettingsEvents(): void {
  els.saveApiKeyBtn.addEventListener("click", () => {
    if (!els.apiKeyInput.value.trim()) return;
    setApiKey(els.apiKeyInput.value);
    els.apiKeyInput.value = "";
    els.apiKeyStatus.textContent = "Key saved.";
  });

  els.clearApiKeyBtn.addEventListener("click", () => {
    clearApiKey();
    els.apiKeyStatus.textContent = "Key cleared.";
  });

  els.modelInput.addEventListener("change", () => {
    void setSetting("openaiModel", els.modelInput.value.trim() || "gpt-5.5");
  });

  els.maxContextInput.addEventListener("change", () => {
    const value = Math.max(0, Math.min(3, Number(els.maxContextInput.value) || 1));
    els.maxContextInput.value = String(value);
    void setSetting("maxContextSentences", value);
  });

  els.buildStyleProfileBtn.addEventListener("click", () => els.styleFilesInput.click());

  els.styleFilesInput.addEventListener("change", () => {
    void (async () => {
      const files = Array.from(els.styleFilesInput.files || []);
      const documents: { title: string; format: string; source: string }[] = [];
      for (const file of files) {
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (!ALLOWED_STYLE_EXTENSIONS.includes(ext)) continue;
        const source = await readFileAsText(file);
        documents.push({ title: file.name, format: determineFormat(file.name), source });
      }
      if (!documents.length) {
        els.styleProfileSummary.textContent = "No .tex, .md, or .txt files found in the selection.";
        return;
      }
      const profile = createStyleProfile(documents, { title: `Style profile from ${documents.length} files` });
      await saveStyleProfile(profile);
      await refreshStyleProfileSummary();
    })();
  });

  els.exportStyleProfileBtn.addEventListener("click", () => {
    void (async () => {
      const profile = await getActiveStyleProfile();
      if (!profile) return;
      downloadText("sentence-gate-style-profile.json", JSON.stringify(profile, null, 2), "application/json");
    })();
  });

  els.importStyleProfileBtn.addEventListener("click", () => els.importStyleProfileInput.click());

  els.importStyleProfileInput.addEventListener("change", () => {
    void (async () => {
      const file = els.importStyleProfileInput.files?.[0];
      if (!file) return;
      const text = await readFileAsText(file);
      try {
        const profile = JSON.parse(text);
        await saveStyleProfile(profile);
        await refreshStyleProfileSummary();
      } catch {
        els.styleProfileSummary.textContent = "That file is not valid style profile JSON.";
      }
    })();
  });

  els.clearStyleProfileBtn.addEventListener("click", () => {
    void (async () => {
      await clearStyleProfile();
      await refreshStyleProfileSummary();
    })();
  });
}

let bound = false;
export function mountSettingsUI(): void {
  if (!bound) {
    bound = true;
    bindSettingsEvents();
  }
  void loadSettingsIntoForm();
}
```

- [ ] **Step 2: Wire it from `src/main.ts`**

Add the import:

```ts
import { mountSettingsUI } from "./settings";
```

Replace the four navigation listener lines at the bottom of `main.ts` with:

```ts
document.getElementById("openSettingsFromLoadBtn")!.addEventListener("click", () => {
  showScreen(settingsScreen);
  mountSettingsUI();
});
document.getElementById("openSettingsFromReviewBtn")!.addEventListener("click", () => {
  showScreen(settingsScreen);
  mountSettingsUI();
});
document.getElementById("backToLoadBtn")!.addEventListener("click", () => showScreen(loadScreen));
document.getElementById("backToLoadFromReviewBtn")!.addEventListener("click", () => showScreen(loadScreen));
```

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`. From the load screen, click `Settings`, paste a (fake, for this
check) API key into the field and click `Save Key` — status should read "Key
saved."; reload the page and reopen Settings — status should read "Key is set."
Click `Clear Key` and confirm it returns to "No key set." Then use `Build From
Files/Folder…` with `examples/sample-paper.tex` selected — the Style Profile
summary should populate with doc/sentence counts.

- [ ] **Step 4: Commit**

```bash
git add src/settings.ts src/main.ts
git commit -m "Wire settings screen: API key, model, style profile management"
```

---

### Task 14: Source preview and "Reveal Source"

**Files:**
- Modify: `src/ui.ts` (extends the file from Tasks 10-12)

Ports `revealSentenceSource` (`apps/vscode/extension.js:365-383`). The extension
jumped to the live VSCode editor and selected a range; the web version has no live
editor, so it highlights the same `[sourceStart, sourceEnd)` range (these offsets
are guaranteed valid against `state.source` by `core.createReviewSession`'s
`attachFallbackSourceRanges`, regardless of whether the document came from a file
upload or pasted text) inside the read-only `#sourcePreview` panel added in Task 7,
and scrolls it into view.

- [ ] **Step 1: Add the `revealSource` function**

Insert just above `let bound = false;` in `src/ui.ts`:

```ts
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
```

- [ ] **Step 2: Wire the button**

Inside `bindEvents()`, add after the `downloadDocBtn` listener:

```ts
  els.revealBtn.addEventListener("click", revealSource);
```

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `examples/sample-paper.tex`, navigate to a sentence, click
`Reveal Source`.
Expected: the "Source Preview" panel expands, the corresponding raw-text range is
visibly highlighted, and the panel scrolls so the highlight is in view.

- [ ] **Step 4: Commit**

```bash
git add src/ui.ts
git commit -m "Wire Reveal Source against the read-only source preview panel"
```

---

### Task 15: GitHub Pages deployment workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deployment workflow"
```

---

### Task 16: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Sentence Gate (Web)

Sentence Gate is a human-in-the-loop sentence review tool for AI-assisted academic
writing. The goal is not to automate authorship — it's to make the author read,
hear, inspect, and explicitly accept every sentence before it enters the final
draft.

This is a static, backend-free web port of the
[Sentence Gate VSCode extension](https://github.com/QianhengZhang/AcademicTexReader).
Everything runs in your browser tab.

## Use it

Open the deployed page (or run locally — see below), then either:

- drag a `.tex` / `.md` / `.markdown` / `.txt` file onto the page, or
- click **Choose File…**, or
- paste text directly.

Sentence Gate splits the draft into sentences and shows them one at a time with:

- adverb, punctuation, rare-word, and AI-like-phrase highlighting
- previous/next sentence context
- cross-document repetition candidates
- review states: `accepted`, `revise`, `repeated`, `delete`, `unsure`
- keyboard shortcuts: `A`/`R`/`E`/`D`/`U` to decide, `←`/`→` to navigate, `Space` to
  read aloud
- direct sentence editing (re-splits the draft and re-maps review decisions)
- a Markdown review report you can download
- an optional local style-profile baseline, built from your own prior papers
- optional AI diagnosis / rewrite suggestions (see below)

Review progress is remembered across browser sessions for the same document
content (matched by a content hash, stored in this browser's IndexedDB).

## Optional AI features

Click **Settings** to paste an OpenAI API key. The key is stored only in this
browser's `localStorage`; requests go directly from this page to OpenAI with no
server in between. **Do not use this on a shared or public computer.**

`AI Diagnosis` and `Rewrite Options` are both opt-in per sentence and are cached
locally by model + sentence text, so re-running the same diagnosis doesn't make
another API call. Rewrite options only load into the edit box — you still review
and click `Apply Edit` yourself.

## Known limitations

- Edits are never written back to a file on your computer automatically. Use
  **Download Edited Document** to save the result after editing.
- The OpenAI key lives in browser `localStorage` in cleartext.

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README"
```

---

### Task 17: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + test pass**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual walkthrough**

Run: `npm run preview` (serves the production build), open the printed URL, and
walk through:

1. Drop `examples/sample-paper.tex` onto the dropzone → review screen opens.
2. Accept a few sentences, revise one, add a note. Use arrow keys and the filter
   dropdown.
3. Click `AI Diagnosis` with no key set → see the "No OpenAI API key configured"
   message rendered in the AI Output panel (not a console error).
4. Go to Settings, paste a real OpenAI key (if you have one) or skip; set the
   model field; build a style profile by selecting `examples/sample-paper.tex`
   again; confirm the summary updates; export the profile JSON; clear it; import
   it back.
5. Return to the review screen — confirm style baseline/comparison panels reflect
   whichever profile state you left it in.
6. Edit the current sentence's text and click `Apply Edit` → confirm re-split and
   that previously accepted sentences keep their status.
7. Click `Export Report` and `Download Edited Document` → confirm both downloads
   land in your downloads folder with sensible content.
8. Click `Reveal Source` → confirm the source preview panel expands and scrolls to
   a highlighted range.
9. Refresh the page, re-drop the **same** `sample-paper.tex` → confirm prior
   decisions are restored from IndexedDB.
10. Re-drop a **modified** copy of the file (edit one word) → confirm it's treated
    as a fresh, unreviewed document.

Expected: every step behaves as described, with no uncaught exceptions in the
browser console.

- [ ] **Step 3: Fix any issues found**

If a step fails, fix the relevant file (most likely `src/ui.ts`,
`src/app-state.ts`, or `src/settings.ts`), re-run the affected unit tests if any
cover that code path, and repeat Step 2 for the affected flow only.

- [ ] **Step 4: Commit** (only if Step 3 required changes)

```bash
git add -A
git commit -m "Fix issues found during end-to-end verification"
```

---

### Task 18: Push to GitHub (requires explicit user go-ahead)

**Files:** none

This pushes to a shared remote (`origin`, already configured to
`https://github.com/QianhengZhang/sentence-gate-web.git`) and is a visible,
hard-to-fully-reverse action — confirm with the user before running it, even if
every prior task completed cleanly.

- [ ] **Step 1: Confirm with the user, then push**

```bash
git push -u origin main
```

- [ ] **Step 2: Tell the user to enable Pages**

In the GitHub repo, go to **Settings → Pages** and set **Source** to **GitHub
Actions** (one-time manual step — cannot be done via API/CLI from here). After
that, every push to `main` will deploy automatically via
`.github/workflows/deploy.yml`.
