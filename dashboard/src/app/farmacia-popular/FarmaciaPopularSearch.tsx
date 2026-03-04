"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Pill,
  Heart,
  BadgePercent,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getFarmaciaPopularMedications,
  getFarmaciaPopularStats,
  type FarmaciaPopularMedication,
  type FarmaciaPopularStats,
} from "@/lib/api";

type Tab = "all" | "free" | "discounted";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function FarmaciaPopularSearch() {
  const [tab, setTab] = useState<Tab>("free");
  const [query, setQuery] = useState("");
  const [medications, setMedications] = useState<FarmaciaPopularMedication[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<FarmaciaPopularStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const fetchMedications = useCallback(async () => {
    setLoading(true);
    try {
      const free = tab === "free" ? true : tab === "discounted" ? false : undefined;
      const result = await getFarmaciaPopularMedications({
        q: query || undefined,
        free,
        limit: pageSize,
        offset: page * pageSize,
      });
      setMedications(result.medications);
      setTotal(result.total);
    } catch {
      setMedications([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, query, page]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  useEffect(() => {
    getFarmaciaPopularStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(0);
  }, [tab, query]);

  const totalPages = Math.ceil(total / pageSize);

  const tabs: { id: Tab; label: string; icon: typeof Heart; count?: number }[] = [
    {
      id: "free",
      label: "Gratuitos",
      icon: Heart,
      count: stats?.total_free,
    },
    {
      id: "discounted",
      label: "Com Desconto",
      icon: BadgePercent,
      count: stats?.total_discounted,
    },
    {
      id: "all",
      label: "Todos",
      icon: Pill,
      count: stats?.total_eligible,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.total_eligible.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-gray-500">Medicamentos</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">
              {stats.total_free.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-green-600">Gratuitos</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-center">
            <p className="text-2xl font-bold text-teal-700">
              {stats.total_discounted.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-teal-600">Com desconto</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar medicamento..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count != null && (
              <span className="text-xs text-gray-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      )}

      {/* Results */}
      {!loading && medications.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-500">
          Nenhum medicamento encontrado.
        </div>
      )}

      {!loading && medications.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {medications.map((med) => (
            <Link
              key={med.id}
              href={`/buscar?q=${encodeURIComponent(med.active_ingredient)}&fp=1`}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {med.product_name}
                  </span>
                </div>
                <p className="mt-0.5 pl-6 text-xs text-gray-500 truncate">
                  {med.active_ingredient} - {med.manufacturer}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {med.farmacia_popular_free ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                    <Heart className="h-3 w-3" />
                    GRATIS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                    <BadgePercent className="h-3 w-3" />
                    Desconto
                  </span>
                )}
                {med.pmc_price != null && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    PMC: {formatCurrency(med.pmc_price)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Pagina {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Proximo
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
