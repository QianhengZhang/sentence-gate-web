import { determineFormat, readFileAsText } from "./files";
import { loadDocument } from "./app-state";
import { mountReviewUI } from "./ui";
import { mountSettingsUI } from "./settings";

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
