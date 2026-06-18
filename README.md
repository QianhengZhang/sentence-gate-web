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
