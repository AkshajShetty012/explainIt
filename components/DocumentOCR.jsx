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
    const variance =
      backgroundCount * foregroundCount * (backgroundMean - foregroundMean) ** 2;

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

    // Doubling small document scans helps Tesseract read fine print without
    // allowing very large uploads to consume excessive memory.
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
      const grayscale = Math.max(
        0,
        Math.min(
          255,
          Math.round(
            (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2] -
              128) *
              1.45 +
              128,
          ),
        ),
      );
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

export default function DocumentOCR() {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    setText("");
    setError("");
    setProgress(null);
    setCopied(false);

    if (!file) {
      setImage(null);
      setPreviewUrl("");
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setImage(null);
      setPreviewUrl("");
      setError("Please choose a PNG, JPG, or JPEG image.");
      event.target.value = "";
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImage(file);
    setPreviewUrl(url);
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
        logger: (message) => {
          setProgress({
            status: message.status,
            percent: Math.round((message.progress || 0) * 100),
          });
        },
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

  return (
    <section className="w-full max-w-2xl space-y-4">
      <label className="block">
        <span className="mb-2 block font-medium">Choose an image</span>
        <input
          type="file"
          accept="image/png,image/jpeg,.jpg,.jpeg"
          onChange={handleImageChange}
          disabled={isProcessing}
        />
      </label>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected document preview"
          className="max-h-96 max-w-full rounded border object-contain"
        />
      )}

      <button
        type="button"
        onClick={extractText}
        disabled={!image || isProcessing}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? "Extracting…" : "Extract Text"}
      </button>

      {isProcessing && progress && (
        <div
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-zinc-600"
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"
          />
          <p>
            Reading document: {progress.status} ({progress.percent}%)
          </p>
        </div>
      )}

      {error && <p role="alert" className="text-red-700">{error}</p>}

      {text && (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Extracted text</h2>
            <button
              type="button"
              onClick={copyText}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {copied ? "Copied" : "Copy text"}
            </button>
          </div>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-zinc-800 selection:bg-blue-100">
            {text}
          </div>
        </section>
      )}
    </section>
  );
}
