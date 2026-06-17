import { sha256Hex } from "./storage";

const API_KEY_STORAGE_KEY = "sentenceGate.openaiApiKey";

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function diagnosisCacheKey(model: string, sentenceText: string): Promise<string> {
  return sha256Hex(`diagnosis\n${model}\n${sentenceText}`);
}

export function rewriteCacheKey(model: string, sentenceText: string): Promise<string> {
  return sha256Hex(`rewrite\n${model}\n${sentenceText}`);
}

export function extractOutputText(body: any): string {
  if (typeof body.output_text === "string") {
    return body.output_text;
  }
  const chunks: string[] = [];
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export interface DiagnosisSentenceInput {
  text: string;
  section: string;
  paragraphIndex: number;
  index: number;
  wordCount: number;
  adverbs: string[];
  punctuation: Record<string, number>;
  rareWordCandidates: string[];
  aiLikePhrases: string[];
  styleComparison: unknown;
}

export interface DiagnosisPayload {
  model: string;
  sentence: DiagnosisSentenceInput;
  previous: string[];
  next: string[];
  repetitionCandidates: unknown[];
  styleProfile: unknown;
}

async function postToResponsesApi(model: string, systemText: string, userPayload: unknown, schemaName: string, schema: unknown): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No OpenAI API key configured. Set it in Settings first.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemText }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(userPayload) }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error && body.error.message ? body.error.message : `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI returned no text output.");
  }
  try {
    return JSON.parse(outputText);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI returned malformed JSON output: ${detail}`);
  }
}

export function diagnoseSentence(payload: DiagnosisPayload): Promise<any> {
  const systemText = [
    "You are Sentence Gate, a diagnostic assistant for human-in-the-loop academic writing review.",
    "Do not rewrite the sentence unless explicitly asked. Diagnose only.",
    "The human author must make the final decision.",
    "Be concrete, restrained, and useful for sentence-level academic review."
  ].join(" ");

  const userPayload = {
    current_sentence: payload.sentence.text,
    current_location: {
      section: payload.sentence.section,
      paragraph_index: payload.sentence.paragraphIndex,
      sentence_index: payload.sentence.index
    },
    local_signals: {
      word_count: payload.sentence.wordCount,
      adverbs: payload.sentence.adverbs,
      punctuation: payload.sentence.punctuation,
      rare_word_candidates: payload.sentence.rareWordCandidates,
      ai_like_phrases: payload.sentence.aiLikePhrases
    },
    previous_context: payload.previous,
    next_context: payload.next,
    broad_repetition_candidates: payload.repetitionCandidates,
    style_profile_summary: payload.styleProfile || null,
    style_comparison: payload.sentence.styleComparison || null,
    task: [
      "Return a concise JSON diagnosis.",
      "Focus on naturalness, clarity, style risk, and whether the human should manually revise.",
      "For repetition_risk, prioritize echoes across paragraphs or sections using broad_repetition_candidates.",
      "For style_note, compare against style_profile_summary and style_comparison when provided.",
      "Do not treat ordinary local cohesion with adjacent sentences as a repetition problem unless it is genuinely redundant."
    ].join(" ")
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      clarity: { type: "string", enum: ["good", "medium", "weak"] },
      naturalness: { type: "string", enum: ["good", "medium", "awkward"] },
      too_ai_like: { type: "boolean" },
      rewrite_needed: { type: "boolean" },
      main_concern: { type: "string" },
      suspicious_words: { type: "array", items: { type: "string" } },
      repetition_risk: { type: "string" },
      style_note: { type: "string" },
      human_action: {
        type: "string",
        enum: ["accept", "revise_manually", "check_repetition", "delete_or_merge", "unsure"]
      }
    },
    required: [
      "clarity", "naturalness", "too_ai_like", "rewrite_needed", "main_concern",
      "suspicious_words", "repetition_risk", "style_note", "human_action"
    ]
  };

  return postToResponsesApi(payload.model, systemText, userPayload, "sentence_gate_diagnosis", schema);
}

export interface RewritePayload {
  model: string;
  sentence: { text: string; styleComparison: unknown };
  previous: string[];
  next: string[];
  styleProfile: unknown;
}

export function suggestRewriteOptions(payload: RewritePayload): Promise<any> {
  const systemText = [
    "You are Sentence Gate, a restrained revision assistant for academic writing.",
    "Return rewrite options only. Do not claim that any rewrite has been applied.",
    "The human author will decide whether to use, edit, or reject the options.",
    "Preserve the author's meaning and avoid adding new claims."
  ].join(" ");

  const userPayload = {
    current_sentence: payload.sentence.text,
    previous_context: payload.previous,
    next_context: payload.next,
    style_profile_summary: payload.styleProfile || null,
    style_comparison: payload.sentence.styleComparison || null,
    task: [
      "Provide two rewrite options.",
      "minimal_edit should preserve structure and change as little as possible.",
      "natural_academic should improve clarity and flow while remaining concise.",
      "Do not split into multiple sentences unless the original is genuinely overloaded."
    ].join(" ")
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      minimal_edit: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" }, rationale: { type: "string" } },
        required: ["text", "rationale"]
      },
      natural_academic: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" }, rationale: { type: "string" } },
        required: ["text", "rationale"]
      },
      caution: { type: "string" }
    },
    required: ["minimal_edit", "natural_academic", "caution"]
  };

  return postToResponsesApi(payload.model, systemText, userPayload, "sentence_gate_rewrite_options", schema);
}
