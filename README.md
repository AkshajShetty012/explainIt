# ExplainIt

### Complex documents. Simple answers.

ExplainIt is a web app that helps people understand difficult or confusing documents.

Upload a document, and ExplainIt extracts the text using OCR and uses Gemma to turn it into a simple, easy-to-understand explanation.

It supports English, Kannada, and Hindi, with optional voice playback.

## How It Works
```

Document
↓
Tesseract.js OCR
↓
Extracted Text
↓
Gemma
↓
Simple Explanation
```

The OCR runs directly in the browser. The original document is not sent to the AI model; only the extracted text is sent to the server for explanation.

## Features

- Upload documents for explanation
- Browser-based OCR with Tesseract.js
- Explanations powered by Gemma
- English, Kannada, and Hindi
- Voice playback
- Designed to flag uncertain OCR instead of guessing
- No database or account required

## Tech Stack

- Next.js
- React
- Tailwind CSS
- Tesseract.js
- Gemma
- Gemini TTS
- Vercel

## Run Locally

Clone the repository:

```bash
git clone https://github.com/AkshajShetty012/explainIt.git
cd explainIt
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file:

```env
GEMINI_API_KEY=your_api_key_here
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Live Demo

https://explain-it-mu.vercel.app/
