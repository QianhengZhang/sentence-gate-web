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
  console.log("Loaded session (ui.ts wiring lands in a later task):", state);
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
