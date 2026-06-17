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
    const parsed = Number(els.maxContextInput.value);
    const value = Math.max(0, Math.min(3, Number.isNaN(parsed) ? 1 : parsed));
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
