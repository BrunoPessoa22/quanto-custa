"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Loader2, FileImage } from "lucide-react";
import { analyzePrescriptionImage, type PrescriptionAnalysis } from "@/lib/api";
import SavingsReport from "./SavingsReport";

export default function ImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrescriptionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);

    setLoading(true);
    try {
      const data = await analyzePrescriptionImage(f);
      setResult(data);
    } catch {
      setError("Erro ao analisar a imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) {
      handleFile(f);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (result && result.items && result.items.length > 0) {
    return <SavingsReport analysis={result} onReset={reset} />;
  }

  return (
    <div>
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-teal-500 bg-teal-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mb-3 h-8 w-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">
            Arraste a foto da receita ou clique para enviar
          </p>
          <p className="mt-1 text-xs text-gray-500">
            JPG, PNG ou HEIC - ate 10MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-4">
            {preview && (
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Receita"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {file.name}
                </span>
              </div>

              {loading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-teal-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando receita com IA...
                </div>
              )}

              {error && (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              )}

              {result && result.items?.length === 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600">
                    Nenhum medicamento identificado na imagem.
                  </p>
                  <button
                    onClick={reset}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    <Camera className="h-4 w-4" />
                    Tentar outra foto
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={reset}
              className="shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
