import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const languageInstructions = {
  English: {
    language: "en",
    instruction: "Speak clearly and naturally in English. Read the transcript verbatim.",
  },
  Kannada: {
    language: "kn",
    instruction: "Speak clearly and naturally in Kannada (ಕನ್ನಡ). Read the transcript verbatim.",
  },
  Hindi: {
    language: "hi",
    instruction: "Speak clearly and naturally in Hindi (हिन्दी). Read the transcript verbatim.",
  },
};

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Audio generation is not configured on the server." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const text = body?.text;
    const language = body?.language;

    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "Explanation text is required." }, { status: 400 });
    }

    const languageConfig = languageInstructions[language];
    if (!languageConfig) {
      return Response.json({ error: "Language must be English, Kannada, or Hindi." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.interactions.create({
      model: "gemini-3.8-flash-tts",
      input: [{
        type: "user_input",
        content: [{
          type: "text",
          text: text.trim(),
          annotations: [{ type: "speech_metadata", style: languageConfig.instruction }],
        }],
      }],
      response_format: { type: "audio", mime_type: "audio/wav" },
      generation_config: {
        speech_config: [{ language: languageConfig.language, voice: "Kore" }],
      },
    });

    const audioBase64 = result.output_audio?.data;
    if (typeof audioBase64 !== "string" || !audioBase64) {
      throw new Error("Gemini returned no audio data.");
    }

    const audio = Buffer.from(audioBase64, "base64");
    if (!audio.length) throw new Error("Gemini returned empty audio data.");

    return new Response(audio, {
      headers: {
        "Content-Type": result.output_audio.mime_type || "audio/wav",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Gemini TTS failed:", error);
    return Response.json(
      { error: "Audio could not be generated. Please try again." },
      { status: 502 },
    );
  }
}
