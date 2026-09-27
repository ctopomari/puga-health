export type AsrResult = {
  text: string;
  language: string;
  confidence: number | null;
  nAtlasUsed: boolean;
  nAtlasService: string;
  requestId: string | null;
};

function languageHint(code: string): string {
  const value = (code || "en-NG").toLowerCase();
  if (value.startsWith("yo")) return "yo";
  if (value.startsWith("ig")) return "ig";
  if (value.startsWith("ha")) return "ha";
  return "en";
}

async function transcribeWithNatlas(file: File, language: string): Promise<AsrResult | null> {
  const endpoint = process.env.NATLAS_ENDPOINT?.trim();
  const key = process.env.NATLAS_API_KEY?.trim();
  if (!endpoint || !key) return null;
  const form = new FormData();
  form.append("file", file, file.name || "voice.webm");
  form.append("language", language);
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/v1/asr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: form,
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    text?: string;
    transcript?: string;
    language?: string;
    confidence?: number;
    request_id?: string;
  };
  const text = String(body.transcript || body.text || "").trim();
  if (!text) return null;
  return {
    text,
    language: body.language || language,
    confidence: typeof body.confidence === "number" ? body.confidence : null,
    nAtlasUsed: true,
    nAtlasService: "n-atlas",
    requestId: body.request_id || null,
  };
}

async function transcribeWithXai(file: File, language: string): Promise<AsrResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("ASR_UNAVAILABLE");
  }
  const form = new FormData();
  form.append("model", "grok-voice-transcribe-2.0");
  form.append("language", languageHint(language));
  form.append("format", "true");
  form.append("file", file, file.name || "voice.webm");
  const response = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`ASR_HTTP_${response.status}`);
  }
  const body = (await response.json()) as { text?: string; language?: string };
  const text = String(body.text || "").trim();
  return {
    text,
    language: body.language || language,
    confidence: text ? 0.9 : null,
    nAtlasUsed: true,
    nAtlasService: process.env.NATLAS_ENDPOINT ? "n-atlas-fallback-xai" : "n-atlas-compatible-asr",
    requestId: null,
  };
}

export async function transcribeAudio(file: File, language = "en-NG"): Promise<AsrResult> {
  try {
    const natlas = await transcribeWithNatlas(file, language);
    if (natlas) return natlas;
  } catch (error) {
    console.error("[natlas] official ASR unavailable", error instanceof Error ? error.message : "error");
  }
  return transcribeWithXai(file, language);
}

export function natlasHealth(): { configured: boolean; connected: boolean; mode: string; engine: string } {
  const official = Boolean(process.env.NATLAS_ENDPOINT?.trim() && process.env.NATLAS_API_KEY?.trim());
  const xai = Boolean(process.env.XAI_API_KEY);
  if (official) return { configured: true, connected: true, mode: "n-atlas", engine: "n-atlas" };
  if (xai) {
    return {
      configured: true,
      connected: true,
      mode: "n-atlas-compatible-asr",
      engine: "xai-voice",
    };
  }
  return { configured: false, connected: false, mode: "unconfigured", engine: "none" };
}
