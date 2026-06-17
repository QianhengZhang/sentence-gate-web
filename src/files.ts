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
