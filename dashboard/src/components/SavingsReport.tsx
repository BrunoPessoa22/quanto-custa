"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingDown,
  Heart,
  Pill,
  Tag,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  Clock,
  User,
} from "lucide-react";
import type { PrescriptionAnalysis, PrescriptionItem } from "@/lib/api";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getCategoryBadge(category: string) {
  switch (category) {
    case "generic":
      return { label: "Generico", className: "bg-green-50 text-green-700 border-green-200" };
    case "reference":
      return { label: "Referencia", className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "similar":
      return { label: "Similar", className: "bg-amber-50 text-amber-700 border-amber-200" };
    default:
      return { label: category, className: "bg-gray-50 text-gray-700 border-gray-200" };
  }
}

function PrescriptionItemRow({ item }: { item: PrescriptionItem }) {
  const [expanded, setExpanded] = useState(false);
  const { extracted, best_match, cheapest_option, farmacia_popular_option, savings, generic_alternatives } = item;

  const hasSavings = savings.amount != null && savings.amount > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Pill className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="font-medium text-gray-900">
              {extracted.name}
            </span>
            {extracted.dosage && (
              <span className="text-sm text-gray-500">{extracted.dosage}</span>
            )}
            {extracted.confidence >= 90 && (
              <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                {extracted.confidence}%
              </span>
            )}
            {extracted.confidence > 0 && extracted.confidence < 90 && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                {extracted.confidence}%
              </span>
            )}
          </div>

          {best_match && (
            <p className="mt-1 text-sm text-gray-500">
              {best_match.active_ingredient} - {best_match.manufacturer}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {farmacia_popular_option && (
            <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
              <Heart className="h-3 w-3" />
              GRATIS
            </span>
          )}
          {hasSavings && !farmacia_popular_option && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
              <TrendingDown className="h-3.5 w-3.5" />
              {savings.percentage?.toFixed(0)}%
            </span>
          )}
          {best_match && (
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(cheapest_option?.price ?? best_match.price)}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {/* Best match */}
          {best_match && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Melhor correspondencia
              </p>
              <Link
                href={`/remedio/${best_match.slug}`}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {best_match.name}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${getCategoryBadge(best_match.category).className}`}>
                      <Tag className="h-2.5 w-2.5" />
                      {getCategoryBadge(best_match.category).label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {best_match.presentation}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(best_match.price)}
                </span>
              </Link>
            </div>
          )}

          {/* Cheapest alternative */}
          {cheapest_option && cheapest_option.id !== best_match?.id && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Opcao mais barata
              </p>
              <Link
                href={`/remedio/${cheapest_option.slug}`}
                className="flex items-center justify-between rounded-md border border-green-100 bg-green-50/50 p-3 hover:bg-green-50"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {cheapest_option.name}
                  </span>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {cheapest_option.manufacturer}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-green-700">
                    {formatCurrency(cheapest_option.price)}
                  </span>
                  {hasSavings && (
                    <p className="text-xs text-green-600">
                      Economia de {formatCurrency(savings.amount!)}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Farmacia Popular */}
          {farmacia_popular_option && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Farmacia Popular
              </p>
              <Link
                href={`/remedio/${farmacia_popular_option.slug}`}
                className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3 hover:bg-green-100"
              >
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-green-600" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {farmacia_popular_option.name}
                    </span>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {farmacia_popular_option.manufacturer}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
                  GRATIS
                </span>
              </Link>
            </div>
          )}

          {/* More alternatives */}
          {generic_alternatives.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {generic_alternatives.length} alternativa{generic_alternatives.length !== 1 ? "s" : ""} encontrada{generic_alternatives.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-1">
                {generic_alternatives.slice(0, 3).map((alt) => (
                  <Link
                    key={alt.id}
                    href={`/remedio/${alt.slug}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="text-gray-700">{alt.name}</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(alt.price)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SavingsReport({
  analysis,
  onReset,
}: {
  analysis: PrescriptionAnalysis;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { prescription, items, summary } = analysis;

  function handleShare() {
    const lines = [
      "Relatorio de economia - Quanto Custa?",
      "",
      `Medicamentos analisados: ${items.length}`,
      `Custo total (referencia): ${formatCurrency(summary.total_reference_cost)}`,
      `Custo mais barato: ${formatCurrency(summary.total_cheapest_cost)}`,
      `Economia potencial: ${formatCurrency(summary.total_savings)} (${summary.total_savings_percentage.toFixed(0)}%)`,
    ];

    if (summary.farmacia_popular_free_count > 0) {
      lines.push(
        `${summary.farmacia_popular_free_count} medicamento(s) GRATIS no Farmacia Popular`
      );
    }

    lines.push("", "Consulte em: quantocusta.com.br");

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Relatorio de economia da sua receita
          </h3>
          {prescription.prescriber && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
              <User className="h-3.5 w-3.5" />
              {prescription.prescriber}
              {prescription.date && (
                <>
                  <span className="mx-1">-</span>
                  <Clock className="h-3.5 w-3.5" />
                  {prescription.date}
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Receipt className="h-4 w-4" />
          Nova receita
        </button>
      </div>

      {/* Summary banner */}
      {hasItems && summary.total_savings > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-green-800">
                Economia potencial encontrada
              </p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {formatCurrency(summary.total_savings)}
              </p>
              <p className="mt-0.5 text-sm text-green-600">
                {summary.total_savings_percentage.toFixed(0)}% de economia em{" "}
                {items.length} medicamento{items.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right space-y-1">
              {summary.farmacia_popular_free_count > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white">
                  <Heart className="h-3 w-3" />
                  {summary.farmacia_popular_free_count} GRATIS no FP
                </div>
              )}
              {summary.farmacia_popular_count > 0 &&
                summary.farmacia_popular_count !== summary.farmacia_popular_free_count && (
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700">
                    <Heart className="h-3 w-3" />
                    {summary.farmacia_popular_count} no Farmacia Popular
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Cost comparison */}
      {hasItems && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Referencia</p>
            <p className="mt-1 text-lg font-semibold text-gray-400 line-through">
              {formatCurrency(summary.total_reference_cost)}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-white p-3">
            <p className="text-xs text-green-600">Menor preco</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(summary.total_cheapest_cost)}
            </p>
          </div>
        </div>
      )}

      {/* Medication items */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <PrescriptionItemRow key={i} item={item} />
        ))}
      </div>

      {/* No items found */}
      {!hasItems && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <Pill className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Nenhum medicamento identificado
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tente enviar uma foto mais nitida da receita.
          </p>
        </div>
      )}

      {/* Share button */}
      {hasItems && (
        <button
          onClick={handleShare}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Copiado!
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              Compartilhar relatorio
            </>
          )}
        </button>
      )}

      {/* Response metadata */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Analisado por {analysis.model_used === "claude" ? "Claude" : "GPT-4o"}{" "}
          - confianca {analysis.overall_confidence}%
        </span>
        <span>{(analysis.response_time_ms / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
