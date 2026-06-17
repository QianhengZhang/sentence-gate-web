import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyEdit, loadDocument, persistReviewState } from "./app-state";

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
