import { GoogleGenAI } from "@google/genai";

const instructions = `You are ExplainIt, a document explanation assistant.

Explain the document in simple language that a normal family member can understand.

Important rules:
- OCR text may contain mistakes.
- Never guess unclear numbers or values.
- If something appears incorrectly OCR'd, explicitly say it may be an OCR error.
- Do not invent information that isn't present in the document.
- For medical documents, explain what the document says but do not diagnose or give medical advice.
- Clearly separate information found in the document from general explanations.

Format the answer:

## What is this document?
Briefly identify it.

## Simple explanation
Explain the important information in simple language.

## Important details
List important values, dates, amounts, names, etc.

## Things to notice
Mention anything noteworthy according to the document's own reference ranges or statements.

## Important note
Mention that OCR can contain errors and unclear values should be verified against the original document.`;

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Gemma is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const text = body?.text;

    if (typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "OCR text is required." },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.interactions.create({
      model: "gemma-4-31b-it",
      system_instruction: instructions,
      input: text,
    });

    if (!response.output_text) {
      throw new Error("Gemma returned no explanation.");
    }

    return Response.json({ explanation: response.output_text });
  } catch (error) {
    console.error("Gemma explanation failed:", error);
    return Response.json(
      { error: "Unable to explain this document right now. Please try again." },
      { status: 500 },
    );
  }
}
