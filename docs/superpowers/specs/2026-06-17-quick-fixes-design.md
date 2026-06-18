# Quick Fixes — Design

## Background

After the initial web port shipped and deployed, the user reported 7 issues.
This spec covers the first, lowest-risk group selected to do first: LaTeX table
parsing, read-aloud pause/resume, and a collapsible context sidebar. The
remaining items (Chinese localization, simpler annotation marks, note export,
and an overall visual redesign away from the VSCode look) are separate
sub-projects to be brainstormed individually later.

## 1. LaTeX table parsing fix

**Problem (confirmed via a probe test against `src/core/index.ts`):**
`\begin{table}...\end{table}` floats are correctly stripped by
`removeLatexBlocks`, but a standalone `\begin{tabular}...\end{tabular}` (not
wrapped in a `table` float — common for inline tables, and `longtable`/
`tabularx` which provide their own float-like behavior) is not in the
strippable-environment list. Its raw markup (column specifiers, `&` column
separators, `\\` row separators) leaks through and gets split into a garbage
"sentence." Example reproduced:

```
input:  \begin{tabular}{ll}\nA & B \\\\\nC & D \\\\\n\end{tabular}
output sentence: "ll A & B \\ C & D \\"
```

**Fix:** extend the existing `\begin{X}...\end{X}` block-removal regex in
`removeLatexBlocks` (`src/core/index.ts`) to include `tabular\*?`, `tabularx`,
`longtable`, and `array` in the alternation of strippable environment names,
alongside the existing `figure|table|equation|align\*?|tikzpicture|lstlisting|verbatim`.
Matching is already begin/end-paired via a backreference (`\1`), not a naive
string search, so this is consistent with how every other block type is
already handled — nesting and environment-name correspondence are respected
the same way.

This is a one-line regex change in already-ported, already-tested code. Add a
unit test in `src/core/core.test.ts` reproducing the standalone-tabular case
above to lock in the fix.

## 2. Read-aloud pause/resume

**Problem:** `speak()` in `src/ui.ts` always calls
`window.speechSynthesis.cancel()` then starts a new utterance from the
beginning. There is no pause/resume — clicking "Read Aloud" again while
already speaking just restarts from word one.

**Fix:** track whether the current sentence is actively speaking or paused.
The "Read Aloud" button becomes a 3-state toggle:

- idle → button reads "Read Aloud"; click starts a new utterance (today's
  behavior, unchanged in this case)
- speaking → button reads "Pause"; click calls `speechSynthesis.pause()`
- paused → button reads "Resume"; click calls `speechSynthesis.resume()`

The `Space`/`S` keyboard shortcut drives the same 3-state toggle (today it
always restarts from the beginning — that changes so keyboard and button stay
consistent). Navigating to a different sentence (`moveWithinFilter`,
`decide`) cancels any in-progress speech, matching the existing
read-state-reset-on-navigation pattern already in `resetReadStateForCurrentSentence`.

Known platform caveat to note in the PR, not a blocker: `speechSynthesis.pause()`/
`resume()` reliability varies slightly across browser engines, but this is an
enhancement over today's "no pause at all," not a regression risk.

## 3. Collapsible context sidebar

**Problem:** the left sidebar (Previous/Current/Next sentence preview) is
always visible, permanently consuming one of the three CSS grid columns in
`.shell`, even though it's secondary/contextual information.

**Fix:** add a collapse toggle button at the top of the `.context` aside.
Collapsing fully hides the column (the chosen behavior, vs. a thin always-visible
rail) — clicking it sets `.shell`'s grid-template-columns to drop that column's
width entirely (e.g. via a `.context-collapsed` class swap), giving the main
review area the reclaimed width. An expand affordance remains visible (e.g. a
small `›` tab) so the user can bring it back. Collapsed/expanded state persists
in `localStorage` (consistent with the app's existing local-persistence-first
design) so it's remembered across page loads.

## Explicitly out of scope for this sub-project

- Any visual restyling beyond the mechanical collapse/expand and pause/resume
  label changes (item #7, "too VSCode-like," is a separate future
  sub-project).
- Chinese localization (#1), simplified annotation marks (#4), and note export
  (#5) are separate future sub-projects.
