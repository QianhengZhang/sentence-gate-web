# Sentence Gate Web — Design

## Background

Sentence Gate is a human-in-the-loop sentence review tool for AI-assisted academic
writing, currently shipped as a VSCode extension (`AcademicTexReader` repo:
`packages/core` + `apps/vscode`). This spec covers a standalone static web port of
the same review experience, deployed via GitHub Pages, with no backend.

`packages/core/index.js` is pure JS with no Node/VSCode dependencies (LaTeX/Markdown
cleanup, sentence splitting, sentence analysis, repetition detection, style
profiling). It moves to the browser unchanged. The VSCode-specific parts of
`apps/vscode/extension.js` (file IO, Secret Storage, webview message passing) are
what need browser-native replacements.

## Architecture

```
sentence-gate-web/
  index.html
  vite.config.ts
  src/
    core/              <- packages/core/index.js, copied verbatim (pure functions)
    main.ts            <- entry point: mounts UI, wires events
    ui.ts               <- DOM rendering/state logic ported from the webview script
    storage.ts          <- IndexedDB wrapper: review state, style profile, AI cache
    openai.ts           <- browser-direct OpenAI fetch calls
    files.ts            <- file upload reading + edited-text export/download
  .github/workflows/deploy.yml   <- build + publish to GitHub Pages on push to main
  README.md
```

Mapping from VSCode capability to browser equivalent:

| VSCode capability | Browser replacement |
|---|---|
| `vscode.window.activeTextEditor` (read open file) | `<input type="file">` / drag-and-drop, read via `FileReader` |
| `vscode.workspace.fs.writeFile` (write back to file, export report) | In-memory edits + "download" button generating a `Blob` |
| `context.secrets` (OpenAI API key storage) | `localStorage` (same-origin, user's own browser only) |
| `.sentence-gate/reviews/*.json` state file | IndexedDB, keyed by SHA-256 of document content |
| Webview HTML/CSS/JS | Same DOM logic ported into `ui.ts`; `acquireVsCodeApi`/`postMessage` removed in favor of direct function calls |
| `revealSentenceSource` (jump to editor, select range) | Highlight + scroll-into-view inside an in-page read-only source preview panel |

No framework: vanilla TypeScript + Vite, matching the zero-dependency style of the
original extension and minimizing the diff between the ported webview script and
its web equivalent.

## File Lifecycle / Editing Flow

1. **Open document**: user drags/selects a `.tex`/`.md`/`.markdown`/`.txt` file, or
   pastes text (equivalent to "Review Clipboard Text"). `files.ts` reads it via
   `FileReader`, determines format from extension (port of `determineFormat`), and
   calls `core.createReviewSession`.
2. **Restore progress**: hash the document text with `crypto.subtle.digest`
   (SHA-256), look up a matching record in IndexedDB's `reviews` store, and restore
   `decisions` / `diagnosisCache` if found.
3. **During review**: every decision/note change is persisted to IndexedDB
   immediately, keyed by document hash. There is no "write back to the original
   file on disk" step — the browser has no handle to it.
4. **Apply Edit**: replacement text is spliced into the in-memory `source` string
   (port of `replaceSourceSentence`), the session is rebuilt via
   `createReviewSession`, and decisions are remapped (port of `remapDecisions` /
   `indexAfterEdit`). Same behavior as the extension, minus `document.save()`.
5. **Export**:
   - **Export Report**: same Markdown report generation as the extension, but
     triggers a browser download instead of writing to `.sentence-gate/reports/`.
   - **Download edited document** (new — the extension didn't need this because it
     edited the source file directly): lets the user retrieve the full text after
     one or more Apply Edit operations.
6. **Style Profile**: built from multiple files selected via
   `<input type="file" multiple webkitdirectory>` (folder picker in
   Chrome/Edge/Firefox; degrades to plain multi-file select elsewhere — same end
   result). The generated profile is stored in IndexedDB and can be exported /
   imported as JSON, replacing direct reads/writes of
   `.sentence-gate/style-profile.json`.
7. **AI features**: triggered on demand exactly as in the extension. `openai.ts`
   reads the API key from `localStorage` and calls
   `https://api.openai.com/v1/responses` directly from the browser. Diagnosis and
   rewrite results are cached in IndexedDB keyed by `sha256(kind + model +
   sentence)`.

## Storage Design (IndexedDB)

Database `sentence-gate`, three object stores:

```
reviews        key: documentHash (sha256 of source text)
  { documentHash, title, format, sentenceCount, decisions, diagnosisCache, savedAt }

styleProfiles  key: profileId (auto; in practice usually one "active" profile)
  { id, title, generatedAt, documentCount, sentenceCount, averageWordCount, ... }

settings       key: "openaiModel" | "maxContextSentences"
  { key, value }
```

- Privacy boundary matches the extension: style profiles store only statistical
  summaries (average word count, common adverbs, punctuation rates, etc.), never
  raw document text. AI calls send only the current sentence, limited context, and
  the statistical style summary — never the full document.
- The OpenAI API key is **not** stored in IndexedDB; it lives in `localStorage`. The
  UI must make clear that the key stays in the user's own browser and requests go
  directly from the browser to OpenAI with no server in between — this is a static
  site, so there is nowhere else to keep it. Users should be warned not to use this
  on shared/public machines.
- There is no "workspace folder" concept on the web, so the extension's per-folder
  `style-profile.json` lookup collapses to a single global active style profile.

## Feature Parity Table

| Extension feature | Web equivalent |
|---|---|
| Start Review (open .tex) | Drag-and-drop / file picker |
| Review Clipboard Text | Paste-into-textarea |
| Sentence review panel (adverb/punctuation highlighting, context, progress, filters) | Ported as-is, same DOM/CSS |
| Keyboard shortcuts (A/R/E/D/U, arrows, space-to-read) | Ported as-is |
| Apply Edit writes back to document | In-memory edit; "download edited document" replaces direct file write |
| Reveal Source (jump to editor, select range) | Read-only source preview panel, highlight + scroll-to |
| Export Report | Browser download of Markdown |
| Build Style Profile from Folder | Multi-file/folder picker → IndexedDB, exportable/importable as JSON |
| Set/Clear OpenAI API Key | Settings panel input → localStorage |
| AI Diagnosis / Rewrite Options | Ported as-is, browser calls OpenAI directly |
| Cross-session progress | IndexedDB, keyed by document content hash |

Known limitations to document in the README: edits are never automatically written
back to the user's local file — they must explicitly download the result; the
OpenAI key is stored in cleartext in browser localStorage and requests originate
from the browser, so this should not be used on shared/public machines.

## Testing & Deployment

- **Unit tests**: `packages/core`'s existing `test.js` is copied over unchanged and
  run via `npm test`, verifying sentence splitting/analysis logic has not
  regressed.
- **Manual verification**: run the full flow against
  `examples/sample-paper.tex` — upload, review, edit, export report, download
  edited document, refresh the page and confirm IndexedDB restores progress.
- **Deployment**: `vite build` produces `dist/`; a GitHub Actions workflow builds
  and publishes to GitHub Pages on every push to `main`. After the repo is created,
  Pages source must be set to "GitHub Actions" in the repo's Settings → Pages (a
  manual one-time step in the GitHub UI).
