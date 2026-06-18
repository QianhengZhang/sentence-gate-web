# Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent, low-risk fixes to the deployed Sentence Gate web app: correct LaTeX table parsing, read-aloud pause/resume, and a collapsible context sidebar.

**Architecture:** Each fix touches a different, narrow slice of the existing codebase — `src/core/index.ts` (pure parsing logic) for the table fix, `src/ui.ts` (review-screen controller) for read-aloud, and `index.html` + `src/ui.ts` for the sidebar. No new files, no new modules.

**Tech Stack:** Same as the existing project — TypeScript, Vite, Vitest, vanilla DOM.

**Spec:** `docs/superpowers/specs/2026-06-17-quick-fixes-design.md`

**Project root:** `/Users/Josh/Documents/sentence-gate-web`

---

### Task 1: Fix LaTeX table parsing (standalone tabular/longtable leaking into sentences)

**Files:**
- Modify: `src/core/index.ts:80`
- Modify: `src/core/core.test.ts`

A standalone `\begin{tabular}...\end{tabular}` (not wrapped in a `table` float) is not in the list of strippable environments in `removeLatexBlocks`, so its raw markup (column specifiers, `&`, `\\`) leaks through as a garbage "sentence." `\begin{table}...\end{table}` already works correctly because `table` is already in the list — this fix just extends the same list.

- [ ] **Step 1: Write the failing test**

Add this test to the `describe("core sentence engine", ...)` block in `src/core/core.test.ts` (add it as a new `it(...)` alongside the existing ones):

```ts
  it("strips standalone tabular/longtable blocks instead of leaking table markup", () => {
    const withTable = `
\\section{Results}
We summarize the results below.

\\begin{tabular}{ll}
A & B \\\\
C & D \\\\
\\end{tabular}

The results show our method outperforms the baseline.
`;
    const session = createReviewSession(withTable, { title: "Results" });
    const texts = session.sentences.map((s) => s.text);
    expect(texts).toEqual([
      "We summarize the results below.",
      "The results show our method outperforms the baseline."
    ]);
    expect(texts.join(" ")).not.toMatch(/&|\\\\/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the new test fails because the actual sentence list includes a third
garbage sentence like `"ll A & B \\ C & D \\"` instead of just the two expected
sentences.

- [ ] **Step 3: Fix the regex**

In `src/core/index.ts`, find this line (currently line 80):

```ts
    .replace(/\\begin\{(figure|table|equation|align\*?|tikzpicture|lstlisting|verbatim)\}[\s\S]*?\\end\{\1\}/g, " ")
```

Replace it with:

```ts
    .replace(/\\begin\{(figure|table|equation|align\*?|tikzpicture|lstlisting|verbatim|tabular\*?|tabularx|longtable|array)\}[\s\S]*?\\end\{\1\}/g, " ")
```

(This is inside the `removeLatexBlocks` function — the only change is adding
`tabular\*?|tabularx|longtable|array` to the alternation. Nothing else in the
function changes.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all tests pass, including the new one and the existing ones (no
regressions; the existing table/figure-stripping tests are unaffected since `table`
and `figure` are still in the list).

- [ ] **Step 5: Commit**

```bash
git add src/core/index.ts src/core/core.test.ts
git commit -m "Fix LaTeX parsing: strip standalone tabular/longtable/array blocks"
```

---

### Task 2: Read-aloud pause/resume

**Files:**
- Modify: `index.html` (add `els.speakBtn` lookup target — no markup change needed, the button already exists)
- Modify: `src/ui.ts`

Today, clicking "Read Aloud" (or pressing Space/S) always cancels and restarts
speech from the beginning. This task turns it into a 3-state toggle (idle →
speaking → paused → speaking → ...) and stops speech automatically when the user
navigates to a different sentence.

No HTML changes are needed — the `#speakBtn` button already exists in
`index.html` from the original port.

- [ ] **Step 1: Add module-level speech-playback state**

In `src/ui.ts`, find this block near the top of the file (currently around line
23-29):

```ts
let state: AppState;
let index = 0;
let filter = "all";
const aiBySentence: Record<string, any> = {};
const rewriteBySentence: Record<string, any> = {};
let readSentenceId: string | null = null;
let lastAutoReadId: string | null = null;
```

Add two new module-level variables right after `lastAutoReadId`:

```ts
let state: AppState;
let index = 0;
let filter = "all";
const aiBySentence: Record<string, any> = {};
const rewriteBySentence: Record<string, any> = {};
let readSentenceId: string | null = null;
let lastAutoReadId: string | null = null;
let speechPlaybackState: "idle" | "speaking" | "paused" = "idle";
let speakingForSentenceId: string | null = null;
```

- [ ] **Step 2: Add `speakBtn` to the `els` object**

Find the `els` object definition (currently starts around line 38). Add
`speakBtn` right after the `readStatus` line:

```ts
  readStatus: byId("readStatus"),
  speakBtn: byId<HTMLButtonElement>("speakBtn"),
```

- [ ] **Step 3: Replace `speak()` with state-tracking versions, and add `toggleSpeech()`/`stopSpeaking()`/`updateSpeakButtonLabel()`**

Find the existing `speak()` function in `src/ui.ts`:

```ts
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
```

Replace it with:

```ts
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
```

- [ ] **Step 4: Stop speech automatically when the displayed sentence changes**

Find `resetReadStateForCurrentSentence`:

```ts
function resetReadStateForCurrentSentence(): void {
  if (readSentenceId !== currentSentence().id) {
    readSentenceId = null;
  }
}
```

Replace it with:

```ts
function resetReadStateForCurrentSentence(): void {
  if (readSentenceId !== currentSentence().id) {
    readSentenceId = null;
  }
  if (speakingForSentenceId !== null && speakingForSentenceId !== currentSentence().id) {
    stopSpeaking();
  }
}
```

(This function already runs at the top of every `render()` call, which fires on
every navigation, decision, and filter change — so this is the single correct
place to detect "the displayed sentence changed" and cancel stale speech.)

- [ ] **Step 5: Wire the button and keyboard shortcut to the toggle**

Find this line inside `bindEvents()`:

```ts
  byId("speakBtn").addEventListener("click", speak);
```

Replace it with:

```ts
  els.speakBtn.addEventListener("click", toggleSpeech);
```

Find this block inside the `keydown` listener in `bindEvents()`:

```ts
    if (event.key === " " || event.key.toLowerCase() === "s") {
      event.preventDefault();
      speak();
    }
```

Replace `speak();` with `toggleSpeech();`:

```ts
    if (event.key === " " || event.key.toLowerCase() === "s") {
      event.preventDefault();
      toggleSpeech();
    }
```

- [ ] **Step 6: Reset speech state when a new document is mounted**

Find `mountReviewUI`:

```ts
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

Replace it with:

```ts
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
  bindEvents();
  render();
}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run build`
Expected: all existing tests pass (this task adds no new unit tests — it's
DOM/Web-Speech-API-dependent interactive behavior, consistent with this file's
established convention of being verified manually rather than unit tested), and
the build succeeds with no TypeScript errors.

As a stronger check, do a real manual or Playwright-driven pass in a Chromium
browser (the same approach used for the project's original end-to-end
verification): open a document, click "Read Aloud" — button should change to
"Pause"; click again — speech should audibly/programmatically pause and button
should read "Resume"; click again — speech resumes and button reads "Pause";
navigate to a different sentence while speaking — speech should stop and the
button should reset to "Read Aloud".

- [ ] **Step 8: Commit**

```bash
git add src/ui.ts
git commit -m "Add read-aloud pause/resume toggle"
```

---

### Task 3: Collapsible context sidebar

**Files:**
- Modify: `index.html`
- Modify: `src/ui.ts`

Adds a "Hide Context" / "Show Context" toggle button in the review screen's
topbar that fully hides the left (Previous/Current/Next) sidebar column,
giving the main sentence-review area the reclaimed width. State persists in
`localStorage` so it's remembered across page loads.

- [ ] **Step 1: Add an `id` to the shell grid container**

In `index.html`, find:

```html
  <div id="reviewScreen" class="screen">
    <div class="shell">
```

Replace with:

```html
  <div id="reviewScreen" class="screen">
    <div class="shell" id="shell">
```

- [ ] **Step 2: Add the toggle button to the topbar**

In `index.html`, find:

```html
        <div class="topbar">
          <span id="counter"></span>
          <span id="location"></span>
          <span id="status" class="status-pill">unreviewed</span>
        </div>
```

Replace with:

```html
        <div class="topbar">
          <span id="counter"></span>
          <span id="location"></span>
          <button id="toggleContextBtn" title="Show or hide the previous/next context panel">Hide Context</button>
          <span id="status" class="status-pill">unreviewed</span>
        </div>
```

- [ ] **Step 3: Add the collapsed-state CSS**

In `index.html`, find the `.shell` rule:

```css
    .shell {
      display: grid;
      grid-template-columns: minmax(140px, 0.45fr) minmax(420px, 1.9fr) minmax(220px, 0.75fr);
      min-height: 100vh;
    }
```

Add a new rule directly after it:

```css
    .shell {
      display: grid;
      grid-template-columns: minmax(140px, 0.45fr) minmax(420px, 1.9fr) minmax(220px, 0.75fr);
      min-height: 100vh;
    }
    .shell.context-collapsed {
      grid-template-columns: 0 minmax(420px, 1.9fr) minmax(220px, 0.75fr);
    }
    .shell.context-collapsed .context {
      visibility: hidden;
      overflow: hidden;
      padding: 0;
    }
```

**Correction (found during implementation, verified with real browser layout
measurements):** the original draft of this step used `display: none;` on
`.context`. That's wrong — `display: none` removes a grid item from CSS Grid's
auto-placement entirely, which shifts `main` and `aside.panel` into the wrong
explicit columns (confirmed by measuring `getBoundingClientRect()` on a real
page: `main` collapsed to ~45px and `aside.panel` ballooned to ~828px,
overlapping the topbar). `visibility: hidden` keeps the item in its grid track
(so column assignment stays correct) while still making it invisible;
`overflow: hidden; padding: 0;` shrinks the now-empty track's rendered content
down to ~1px so it doesn't leave a visible gap. Use the code block above, not
`display: none`.

- [ ] **Step 4: Verify the build still succeeds with the HTML changes alone**

Run: `npm run build`
Expected: succeeds (the new button has no listener yet, so it's inert — that's
fine, Step 5 wires it).

- [ ] **Step 5: Wire the toggle in `src/ui.ts`**

Add a constant near the top of `src/ui.ts`, right after the existing
`interface Decision { ... }` block:

```ts
const CONTEXT_COLLAPSED_KEY = "sentenceGate.contextCollapsed";
```

Add `shell` and `toggleContextBtn` to the `els` object — insert them right
after the `workflowStatus` line (the last entry in the object):

```ts
  workflowStatus: byId("workflowStatus"),
  shell: byId("shell"),
  toggleContextBtn: byId<HTMLButtonElement>("toggleContextBtn")
```

(Note: this changes the previous last entry from ending with `workflowStatus:
byId("workflowStatus")` with no trailing comma, to having a trailing comma
since it's no longer the last property — the object literal still needs valid
syntax, i.e. exactly one trailing comma-free final entry.)

Add this function just above `let bound = false;`:

```ts
function updateContextToggle(): void {
  const collapsed = localStorage.getItem(CONTEXT_COLLAPSED_KEY) === "1";
  els.shell.classList.toggle("context-collapsed", collapsed);
  els.toggleContextBtn.textContent = collapsed ? "Show Context" : "Hide Context";
}
```

Inside `bindEvents()`, add this listener (anywhere among the other listeners,
e.g. right after the `els.revealBtn` listener added in an earlier task):

```ts
  els.toggleContextBtn.addEventListener("click", () => {
    const collapsed = els.shell.classList.contains("context-collapsed");
    if (collapsed) {
      localStorage.removeItem(CONTEXT_COLLAPSED_KEY);
    } else {
      localStorage.setItem(CONTEXT_COLLAPSED_KEY, "1");
    }
    updateContextToggle();
  });
```

In `mountReviewUI`, add a call to `updateContextToggle()` right before
`render();`:

```ts
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
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: all tests still pass, build succeeds with no TypeScript errors.

Manual/Playwright check: open a document, click "Hide Context" — the left
sidebar disappears, the button now reads "Show Context", and the main sentence
area visibly widens. Click "Show Context" — sidebar reappears. Refresh the
page and reload any document — the collapsed/expanded state from before the
refresh is still in effect (confirms the `localStorage` persistence works).

- [ ] **Step 7: Commit**

```bash
git add index.html src/ui.ts
git commit -m "Add collapsible context sidebar with persisted state"
```

---

### Task 4: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test and build**

Run: `npm test && npm run build`
Expected: all tests pass (38 total: 37 from before plus the 1 new table-parsing
test), build succeeds with no TypeScript errors.

- [ ] **Step 2: Combined manual/Playwright walkthrough**

Using the same approach as the original project's end-to-end verification
(real Chromium via Playwright, or manual browser testing), confirm all three
fixes work together in one session:

1. Open a `.tex` document containing a standalone `\begin{tabular}...\end{tabular}`
   block — confirm no garbage table-markup sentence appears in the review list.
2. Click "Read Aloud", then "Pause", then "Resume", then navigate to another
   sentence mid-speech — confirm the button label and audio state transition
   correctly at each step and speech stops on navigation.
3. Click "Hide Context", refresh the page, reopen the same or a different
   document — confirm the sidebar stays hidden across the reload, then click
   "Show Context" to restore it.

Expected: all three behave as designed, with no console errors or uncaught
exceptions.

- [ ] **Step 3: Push**

This is a small, low-risk batch of fixes to an already-deployed app. Confirm
with the user before pushing (pushing triggers the GitHub Actions deploy
workflow and updates the live site), then:

```bash
git push
```
