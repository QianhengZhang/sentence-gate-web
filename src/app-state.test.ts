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
