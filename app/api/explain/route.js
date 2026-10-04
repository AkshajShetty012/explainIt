import { GoogleGenAI } from "@google/genai";

const languageGuidance = {
  English: {
    opening: 'Start with one sentence beginning exactly: "This appears to be a ..."',
    headings: "Summary, Important values/details, Dates, Amounts, Required actions",
    closing:
      "Important: This is an explanation of the document, not professional medical, legal, or financial advice. Verify unclear information against the original document and consult the appropriate professional when necessary.",
  },
  Kannada: {
    opening: 'Start with a one-sentence identification beginning: "ಇದು ... ಎಂದು ಕಾಣುತ್ತದೆ."',
    headings:
      "ಸಾರಾಂಶ, ಪ್ರಮುಖ ಮೌಲ್ಯಗಳು/ವಿವರಗಳು, ದಿನಾಂಕಗಳು, ಮೊತ್ತಗಳು, ಅಗತ್ಯ ಕ್ರಮಗಳು",
    closing:
      "ಮುಖ್ಯ: ಇದು ದಾಖಲೆಯ ವಿವರಣೆ ಮಾತ್ರ; ವೃತ್ತಿಪರ ವೈದ್ಯಕೀಯ, ಕಾನೂನು, ಅಥವಾ ಹಣಕಾಸು ಸಲಹೆಯಲ್ಲ. ಅಸ್ಪಷ್ಟ ಮಾಹಿತಿಯನ್ನು ಮೂಲ ದಾಖಲೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಅಗತ್ಯವಿದ್ದರೆ ಸೂಕ್ತ ವೃತ್ತಿಪರರನ್ನು ಸಂಪರ್ಕಿಸಿ.",
  },
  Hindi: {
    opening: 'Start with a one-sentence identification beginning: "यह ... प्रतीत होता है।"',
    headings: "सारांश, महत्वपूर्ण मान/विवरण, तिथियाँ, राशियाँ, आवश्यक कार्यवाही",
    closing:
      "महत्वपूर्ण: यह दस्तावेज़ की व्याख्या है, पेशेवर चिकित्सा, कानूनी या वित्तीय सलाह नहीं। अस्पष्ट जानकारी को मूल दस्तावेज़ से सत्यापित करें और आवश्यकता होने पर उचित विशेषज्ञ से सलाह लें।",
  },
};

function getInstructions(language) {
  const guidance = languageGuidance[language];

  return `You are ExplainIt, a document explanation assistant. Generate the entire explanation in ${language}, using concise, simple language for a non-technical family member. Explain documents such as medical reports, bills, notices, and official letters.

Use this format:

${guidance.opening}

Use these headings in ${language}: ${guidance.headings}. Add the headings for important values/details, dates, amounts, and required actions only when the document clearly contains relevant information.

## Summary
Give a short plain-language summary of the document.

## Important values/details
List the most important names, measurements, reference ranges, identifiers, or other details.

## Dates
List important dates and what each date refers to.

## Amounts
List important charges, balances, payments, or other amounts.

## Required actions
List actions, deadlines, or requests stated in the document.

Translate the headings above into ${language}; preserve their meaning. Keep technical values, test names, units, dates, and numbers exactly as extracted. Do not translate, correct, or reformat them. If OCR seems uncertain, explicitly say so.

For tables, preserve the relationship between each item or test name, its value, and its reference range whenever that relationship is clearly readable. Do not invent a missing value, unit, or range. If OCR seems to have mixed columns or made the relationship unclear, explicitly flag that uncertainty and ask the reader to check the original image.

For medical reports:
- Explain what each important measurement generally represents in brief, plain language.
- Compare a value with a reference range only when both are clearly readable and clearly associated.
- Say "the report indicates..." rather than making a diagnosis.
- Never diagnose a disease or recommend medication or treatment.

OCR safety rules:
- OCR can misread numbers, symbols, names, units, and table columns.
- Never silently correct an OCR value or fabricate information to make the explanation complete.
- If a value looks suspicious or unclear, say that it may be an OCR error and should be checked against the original image.

End with this exact sentence:
${guidance.closing}`;
}

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
    const language = body?.language || "English";

    if (typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "OCR text is required." },
        { status: 400 },
      );
    }

    if (!Object.hasOwn(languageGuidance, language)) {
      return Response.json(
        { error: "Language must be English, Kannada, or Hindi." },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.interactions.create({
      model: "gemma-4-31b-it",
      system_instruction: getInstructions(language),
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
