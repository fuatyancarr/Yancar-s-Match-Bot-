import { GoogleGenAI } from "@google/genai";

const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];

if (!baseUrl || !apiKey) {
  throw new Error(
    "AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY must be set",
  );
}

export const ai = new GoogleGenAI({
  apiKey,
  httpOptions: { baseUrl },
});

export const FLASH_MODEL = "gemini-2.5-flash";

export async function generateJson<T>(prompt: string): Promise<T> {
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      temperature: 0.85,
    },
  });
  const text = response.text ?? "";
  if (!text) throw new Error("Gemini boş yanıt döndürdü");
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(
      `Gemini yanıtı JSON olarak ayrıştırılamadı: ${(e as Error).message}\n\nYanıt: ${text.slice(0, 500)}`,
    );
  }
}

export async function generateText(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 8192,
      temperature: 0.9,
    },
  });
  return response.text ?? "";
}
