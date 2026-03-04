"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Camera, MapPin, X, Loader2 } from "lucide-react";
import { BRAZILIAN_STATES, type StateCode } from "@/lib/constants";
import type { SearchSuggestion } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface SearchBarProps {
  initialQuery?: string;
  initialState?: StateCode;
  size?: "large" | "default";
  showUpload?: boolean;
  onImageSelect?: (file: File) => void;
}

export default function SearchBar({
  initialQuery = "",
  initialState = "SP",
  size = "default",
  showUpload = false,
  onImageSelect,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<StateCode>(initialState);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/search/suggestions?q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);
    router.push(`/buscar?q=${encodeURIComponent(query.trim())}&estado=${state}`);
  }

  function handleSuggestionClick(suggestion: SearchSuggestion) {
    setShowSuggestions(false);
    router.push(`/remedio/${suggestion.slug}`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onImageSelect) {
      onImageSelect(file);
    }
  }

  const isLarge = size === "large";

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 ${isLarge ? "h-5 w-5" : "h-4 w-4"}`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Digite o nome do medicamento..."
            className={`w-full rounded-lg border border-gray-200 bg-white pl-12 pr-10 text-gray-900 placeholder-gray-400 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
              isLarge ? "py-4 text-lg" : "py-3 text-base"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={state}
              onChange={(e) => setState(e.target.value as StateCode)}
              className={`appearance-none rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-gray-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                isLarge ? "py-4" : "py-3"
              }`}
            >
              {BRAZILIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className={`rounded-lg bg-teal-600 font-medium text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
              isLarge ? "px-8 py-4 text-lg" : "px-6 py-3"
            }`}
          >
            Buscar
          </button>
        </div>
      </form>

      {showUpload && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <Camera className="h-4 w-4" />
            Ou tire uma foto da receita
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {showSuggestions && (suggestions.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(s)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {s.name}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {s.active_ingredient}
                </span>
                <span
                  className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                    s.category === "generic"
                      ? "bg-green-50 text-green-700"
                      : s.category === "reference"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {s.category === "generic"
                    ? "Generico"
                    : s.category === "reference"
                      ? "Referencia"
                      : "Similar"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
