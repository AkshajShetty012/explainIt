"use client";

import { useEffect, useRef, useState } from "react";
import { createWorker, PSM } from "tesseract.js";

function getOtsuThreshold(histogram, pixelCount) {
  let total = 0;
  for (let value = 0; value < 256; value += 1) total += value * histogram[value];
  let backgroundCount = 0;
  let backgroundTotal = 0;
  let highestVariance = 0;
  let threshold = 160;

  for (let value = 0; value < 256; value += 1) {
    backgroundCount += histogram[value];
    if (backgroundCount === 0) continue;
    const foregroundCount = pixelCount - backgroundCount;
    if (foregroundCount === 0) break;
    backgroundTotal += value * histogram[value];
    const backgroundMean = backgroundTotal / backgroundCount;
    const foregroundMean = (total - backgroundTotal) / foregroundCount;
    const variance = backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2;
    if (variance > highestVariance) {
      highestVariance = variance;
      threshold = value;
    }
  }
  return threshold;
}

async function preprocessImage(file) {
  const sourceUrl = URL.createObjectURL(file);
  const source = new Image();
  try {
    await new Promise((resolve, reject) => {
      source.onload = resolve;
      source.onerror = () => reject(new Error("Could not read the selected image."));
      source.src = sourceUrl;
    });
    const scale = Math.min(2, 3200 / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const histogram = new Uint32Array(256);
    for (let index = 0; index < data.length; index += 4) {
      const grayscale = Math.max(0, Math.min(255, Math.round((0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2] - 128) * 1.45 + 128)));
      data[index] = grayscale;
      data[index + 1] = grayscale;
      data[index + 2] = grayscale;
      histogram[grayscale] += 1;
    }
    const threshold = getOtsuThreshold(histogram, canvas.width * canvas.height);
    for (let index = 0; index < data.length; index += 4) {
      const value = data[index] > threshold ? 255 : 0;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function Icon({ children, className = "" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">{children}</svg>;
}

function Sparkle({ className }) {
  return <Icon className={className}><path d="m12 3 1.45 5.55L19 10l-5.55 1.45L12 17l-1.45-5.55L5 10l5.55-1.45L12 3Z" strokeLinecap="round" strokeLinejoin="round" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
}

function CopyIcon() {
  return <Icon className="h-3.5 w-3.5"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeLinecap="round" /></Icon>;
}

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-zinc-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderExplanation(explanation) {
  return explanation.split("\n").map((line, index) => {
    if (line.startsWith("## ")) return <h3 key={index} className="mt-8 text-[18px] font-semibold tracking-tight text-zinc-900 first:mt-0">{renderInline(line.slice(3))}</h3>;
    if (line.startsWith("### ")) return <h4 key={index} className="mt-6 text-[15px] font-semibold text-zinc-800">{renderInline(line.slice(4))}</h4>;
    if (line.startsWith("- ") || line.startsWith("• ")) return <p key={index} className="mt-3 flex gap-2"> <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{renderInline(line.slice(2))}</p>;
    if (!line.trim()) return <div key={index} className="h-3" />;
    return <p key={index} className="mt-3">{renderInline(line)}</p>;
  });
}

function stripMarkdown(text) {
  return text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/gm, "")
    .replace(/^\|(.+)\|$/gm, "$1")
    .replace(/\|/g, ", ")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/[*_#~`]/g, "")
    .replace(/[•▪◦‣⁃]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[★☆✦✧→←↑↓✓✔️⚠️🔒]/gu, "")
    .replace(/^[\s\-–—=]{3,}$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function DocumentOCR() {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explanationError, setExplanationError] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [language, setLanguage] = useState("English");
  const [isDragging, setIsDragging] = useState(false);
  const [explanationCopied, setExplanationCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const previewUrlRef = useRef("");
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const audioOperationRef = useRef(0);
  const ttsRequestRef = useRef(false);
  const fileInputRef = useRef(null);
  const languageMenuRef = useRef(null);
  const languageOptionRefs = useRef([]);
  const languages = ["English", "Kannada", "Hindi"];

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    const preventDocumentDrop = (event) => event.preventDefault();
    window.addEventListener("dragover", preventDocumentDrop);
    window.addEventListener("drop", preventDocumentDrop);
    return () => {
      window.removeEventListener("dragover", preventDocumentDrop);
      window.removeEventListener("drop", preventDocumentDrop);
    };
  }, []);

  useEffect(() => {
    function closeLanguageMenu(event) {
      if (!languageMenuRef.current?.contains(event.target)) setIsLanguageMenuOpen(false);
    }
    document.addEventListener("mousedown", closeLanguageMenu);
    return () => document.removeEventListener("mousedown", closeLanguageMenu);
  }, []);

  function chooseLanguage(nextLanguage) {
    stopAudio();
    setLanguage(nextLanguage);
    setExplanation("");
    setExplanationError("");
    setIsLanguageMenuOpen(false);
  }

  function handleLanguageKeyDown(event) {
    const currentIndex = languages.indexOf(language);
    if (event.key === "Escape") {
      setIsLanguageMenuOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1) % languages.length
        : (currentIndex - 1 + languages.length) % languages.length;
      setLanguage(languages[nextIndex]);
      stopAudio();
      setExplanation("");
      setExplanationError("");
      setIsLanguageMenuOpen(true);
      requestAnimationFrame(() => languageOptionRefs.current[nextIndex]?.focus());
    }
  }

  function selectImage(file) {
    setText("");
    setError("");
    setProgress(null);
    setCopied(false);
    setExplanation("");
    setExplanationError("");
    setExplanationCopied(false);
    if (!file) {
      setImage(null);
      setPreviewUrl("");
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setImage(null);
      setPreviewUrl("");
      setError("Please choose a PNG, JPG, or JPEG image.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImage(file);
    setPreviewUrl(url);
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    selectImage(file);
    if (file && !["image/png", "image/jpeg"].includes(file.type)) event.target.value = "";
  }

  async function extractText() {
    if (!image || isProcessing) return;
    setIsProcessing(true);
    setError("");
    setText("");
    setProgress({ status: "Starting OCR", percent: 0 });
    let worker;
    let processedImage;
    try {
      processedImage = await preprocessImage(image);
      worker = await createWorker("eng", 1, {
        logger: (message) => setProgress({ status: message.status, percent: Math.round((message.progress || 0) * 100) }),
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      const result = await worker.recognize(processedImage);
      setText(result.data.text.trim());
    } catch (err) {
      console.error("OCR failed:", err);
      setError("Text extraction failed. Please try another image.");
    } finally {
      if (worker) await worker.terminate();
      if (processedImage) {
        processedImage.width = 0;
        processedImage.height = 0;
      }
      setIsProcessing(false);
      setProgress(null);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
      setError("Could not copy the extracted text.");
    }
  }

  async function explainWithGemma() {
    if (!text || isExplaining) return;
    stopAudio();
    setIsExplaining(true);
    setExplanation("");
    setExplanationError("");
    setExplanationCopied(false);
    try {
      const response = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not explain the document.");
      setExplanation(data.explanation);
    } catch (err) {
      console.error("Explanation failed:", err);
      setExplanationError(err.message || "Could not explain the document.");
    } finally {
      setIsExplaining(false);
    }
  }

  async function copyExplanation() {
    try {
      await navigator.clipboard.writeText(explanation);
      setExplanationCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
      setExplanationError("Could not copy the explanation.");
    }
  }

  function releaseAudioSource({ pause = true, resetTime = true } = {}) {
    const audio = audioRef.current;
    const audioUrl = audioUrlRef.current;
    audioUrlRef.current = "";
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      if (pause && !audio.paused) audio.pause();
      if (resetTime && audio.readyState > 0) audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }

  function stopAudio() {
    audioOperationRef.current += 1;
    ttsRequestRef.current = false;
    releaseAudioSource();
    setIsListening(false);
    setIsGeneratingAudio(false);
  }

  async function listenToExplanation() {
    if (isListening) {
      stopAudio();
      return;
    }
    if (isGeneratingAudio || ttsRequestRef.current) return;

    if (!explanation) {
      setExplanationError("There is no explanation available to read yet.");
      return;
    }

    const spokenText = stripMarkdown(explanation);
    if (!spokenText) {
      setExplanationError("There is no readable text in this explanation.");
      return;
    }

    const operationId = audioOperationRef.current + 1;
    audioOperationRef.current = operationId;
    ttsRequestRef.current = true;
    const requestStartedAt = new Date();
    setIsGeneratingAudio(true);
    setExplanationError("");
    try {
      if (process.env.NODE_ENV === "development") {
        console.debug("[ExplainIt TTS] request started", { at: new Date().toISOString(), language });
      }
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spokenText, language }),
      });

      const apiResponseAt = new Date();
      if (process.env.NODE_ENV === "development") {
        console.debug("[ExplainIt TTS] API response time", `${apiResponseAt.getTime() - requestStartedAt.getTime()} ms`, { status: response.status });
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Audio could not be generated. Please try again.");
      }

      const audioBlob = await response.blob();
      if (process.env.NODE_ENV === "development") {
        console.debug("[ExplainIt TTS] audio blob size", audioBlob.size, "bytes");
      }
      if (!audioBlob.size || !audioBlob.type.startsWith("audio/")) {
        throw new Error("Audio generation returned an invalid audio file. Please try again.");
      }

      if (audioOperationRef.current !== operationId) return;

      const audio = audioRef.current;
      if (!audio) throw new Error("The audio player is not available. Please try again.");

      releaseAudioSource();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      audio.onplay = () => {
        if (audioOperationRef.current !== operationId) return;
        setIsListening(true);
        if (process.env.NODE_ENV === "development") {
          console.debug("[ExplainIt TTS] playback started", {
            at: new Date().toISOString(),
            afterRequest: `${new Date().getTime() - requestStartedAt.getTime()} ms`,
          });
        }
      };
      audio.onended = () => {
        if (audioOperationRef.current === operationId) {
          audioOperationRef.current += 1;
          releaseAudioSource({ pause: false, resetTime: false });
          ttsRequestRef.current = false;
          setIsListening(false);
          setIsGeneratingAudio(false);
        }
      };
      audio.onerror = () => {
        if (audioOperationRef.current === operationId) {
          releaseAudioSource();
          ttsRequestRef.current = false;
          setIsListening(false);
          setExplanationError("The generated audio could not be played by this browser.");
        }
      };

      audio.src = audioUrl;
      audio.load();
      await audio.play();
      if (audioOperationRef.current !== operationId) return;
      ttsRequestRef.current = false;
      setIsListening(true);
    } catch (error) {
      if (audioOperationRef.current === operationId) {
        releaseAudioSource();
        ttsRequestRef.current = false;
        setIsListening(false);
        console.error("Gemini audio playback failed:", error);
        setExplanationError(error.message || "Audio could not be played. Please try again.");
      }
    } finally {
      if (audioOperationRef.current === operationId) setIsGeneratingAudio(false);
    }
  }

  return (
    <section className="w-full">
      <audio ref={audioRef} preload="none" aria-hidden="true" className="sr-only" />
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,.jpg,.jpeg" onChange={handleImageChange} disabled={isProcessing} className="sr-only" />
      {!image ? (
        <div className="mx-auto max-w-3xl py-10 text-center sm:py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"><Sparkle className="h-3.5 w-3.5" />Clear explanations, in seconds</div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-zinc-900 sm:text-6xl">Understand what your documents actually mean.</h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-zinc-600 sm:text-lg">Upload a confusing document and get a simple explanation in seconds.</p>
          <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectImage(event.dataTransfer.files?.[0]); }} className={`mt-10 rounded-3xl border border-dashed p-7 shadow-[0_16px_50px_rgba(67,48,26,0.08)] transition sm:p-10 ${isDragging ? "border-amber-400 bg-amber-50" : "border-zinc-300 bg-white/90"}`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800"><Icon className="h-6 w-6"><path d="M12 16V4m0 0 4 4m-4-4L8 8M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" /></Icon></div>
            <h2 className="mt-5 text-lg font-semibold text-zinc-900">{isDragging ? "Drop your document here" : "Drop your document here"}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{isDragging ? "Release to upload your document." : "Drag and drop an image, or choose a file from your device."}</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-6 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700">Select file</button><p className="mt-4 text-xs text-zinc-500">Supports PNG, JPG, and JPEG files</p>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
          <p className="mt-5 text-xs text-zinc-500">🔒 Your original document stays in your browser</p>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl py-5 sm:py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium text-zinc-600">Your document</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Let’s make this easier to understand.</h1></div><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50">Choose another file</button></div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-5">
              <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_35px_rgba(67,48,26,0.06)]"><div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">▧</span><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">{image.name}</p><p className="text-xs text-zinc-500">Original document</p></div></div><div className="flex min-h-72 items-center justify-center bg-[#f8f6f1] p-5"><img src={previewUrl} alt={`Preview of ${image.name}`} className="max-h-[27rem] max-w-full rounded-lg object-contain shadow-sm" /></div></section>
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_12px_35px_rgba(67,48,26,0.06)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-zinc-900">Extract document text</h2><p className="mt-1 text-sm text-zinc-500">We’ll read the image directly in your browser.</p></div><button type="button" onClick={extractText} disabled={isProcessing} className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50">{isProcessing ? "Extracting…" : "Extract text"}</button></div>{isProcessing && progress && <div aria-live="polite" className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900"><div className="flex items-center gap-2"><span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-200 border-t-amber-700" />Reading document · {progress.status} ({progress.percent}%)</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-600 transition-all" style={{ width: `${progress.percent}%` }} /></div></div>}{error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}</section>
              {text && <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_35px_rgba(67,48,26,0.06)]"><div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4"><div><h2 className="font-semibold text-zinc-900">Extracted text</h2><p className="mt-0.5 text-xs text-zinc-500">Review this before explaining</p></div><button type="button" onClick={copyText} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"><CopyIcon />{copied ? "Copied" : "Copy"}</button></div><div className="max-h-80 overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-zinc-700 selection:bg-amber-100">{text}</div></section>}
            </div>
            <aside className="min-w-0"><section className={`min-h-full rounded-3xl border p-5 shadow-[0_16px_45px_rgba(67,48,26,0.08)] sm:p-7 ${explanation ? "border-zinc-300 bg-white" : "border-zinc-200 bg-[#fffdf8]"}`}><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><Sparkle className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-zinc-600">ExplainIt AI</p><h2 className="text-lg font-semibold tracking-tight text-zinc-900">Here’s what it means</h2></div></div>{explanation && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">Ready</span>}</div>
              {!text ? <div className="mt-12 rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-6 text-center"><Sparkle className="mx-auto h-6 w-6 text-zinc-400" /><h3 className="mt-4 font-medium text-zinc-800">Your explanation will appear here</h3><p className="mt-2 text-sm leading-6 text-zinc-500">Extract the document text first, then choose a language and ask ExplainIt for a clearer summary.</p></div> : <>
                {!explanation && !isExplaining && <div className="mt-8"><p className="text-sm leading-6 text-zinc-600">The text is ready. Choose a language and get a simple, structured explanation.</p><div className="mt-6 flex flex-wrap items-end gap-3"><div ref={languageMenuRef} className="relative"><span className="mb-1.5 block text-xs font-medium text-zinc-600">Explanation language</span><button type="button" aria-haspopup="listbox" aria-expanded={isLanguageMenuOpen} aria-controls="language-options" onClick={() => setIsLanguageMenuOpen((open) => !open)} onKeyDown={handleLanguageKeyDown} disabled={isExplaining} className="flex min-w-36 items-center justify-between gap-5 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm outline-none transition hover:border-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:opacity-60">{language}<span aria-hidden="true" className="text-xs text-zinc-500">⌄</span></button>{isLanguageMenuOpen && <div id="language-options" role="listbox" aria-label="Explanation language" className="absolute left-0 top-full z-20 mt-2 min-w-full overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-[0_8px_20px_rgba(39,35,30,0.12)]">{languages.map((option, index) => <button key={option} ref={(element) => { languageOptionRefs.current[index] = element; }} type="button" role="option" aria-selected={language === option} onClick={() => chooseLanguage(option)} onKeyDown={(event) => { if (event.key === "Escape") { setIsLanguageMenuOpen(false); return; } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const nextIndex = event.key === "ArrowDown" ? (index + 1) % languages.length : (index - 1 + languages.length) % languages.length; languageOptionRefs.current[nextIndex]?.focus(); } if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseLanguage(option); } }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 ${language === option ? "bg-zinc-50 font-medium" : ""}`}>{option}{language === option && <span aria-hidden="true" className="text-zinc-700">✓</span>}</button>)}</div>}</div><button type="button" onClick={explainWithGemma} disabled={isExplaining} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-zinc-700 disabled:opacity-50"><Sparkle className="h-4 w-4" />Explain with Gemma</button></div></div>}
                {isExplaining && <div aria-live="polite" className="mt-10 space-y-4"><div className="flex items-center gap-2 text-sm font-medium text-zinc-700"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />Creating a simple explanation…</div><div className="space-y-3"><div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" /><div className="h-4 w-full animate-pulse rounded bg-zinc-100" /><div className="h-4 w-3/5 animate-pulse rounded bg-zinc-100" /></div></div>}
                {explanationError && <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{explanationError}</p>}
                {explanation && <div className="mt-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4"><p className="text-sm text-zinc-500">In {language}</p><div className="flex items-center gap-1"><button type="button" onClick={listenToExplanation} disabled={isGeneratingAudio} aria-busy={isGeneratingAudio} aria-label={isGeneratingAudio ? "Generating audio" : isListening ? "Stop listening" : "Listen to explanation"} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-wait disabled:opacity-60"><span>🔊</span>{isGeneratingAudio ? "Generating audio..." : isListening ? "Stop" : "Listen"}</button><button type="button" onClick={copyExplanation} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"><CopyIcon />{explanationCopied ? "Copied" : "Copy"}</button></div></div><div className="max-w-2xl text-[15px] leading-[1.7] text-zinc-700">{renderExplanation(explanation)}</div></div>}
              </>}</section></aside>
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-zinc-500">🔒 Your original document stays in your browser. Only extracted text is sent for AI explanation.</p>
        </div>
      )}
    </section>
  );
}
