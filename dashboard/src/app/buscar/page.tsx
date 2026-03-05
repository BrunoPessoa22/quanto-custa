import { Suspense } from "react";
import type { Metadata } from "next";
import { SlidersHorizontal, ArrowUpDown, Heart, Loader2 } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import MedicationCard from "@/components/MedicationCard";
import { searchMedications, type MedicationWithPrice } from "@/lib/api";
import type { StateCode } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Buscar medicamentos",
  description:
    "Busque e compare precos de medicamentos no Brasil com dados da ANVISA.",
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string; estado?: string; tipo?: string; fp?: string; ordenar?: string }>;
}

function SortButton({
  label,
  value,
  current,
  params,
}: {
  label: string;
  value: string;
  current: string;
  params: URLSearchParams;
}) {
  const newParams = new URLSearchParams(params);
  newParams.set("ordenar", value);
  return (
    <a
      href={`/buscar?${newParams.toString()}`}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        current === value
          ? "bg-teal-600 text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </a>
  );
}

function FilterButton({
  label,
  value,
  paramKey,
  current,
  params,
}: {
  label: string;
  value: string;
  paramKey: string;
  current: string | null;
  params: URLSearchParams;
}) {
  const isActive = current === value;
  const newParams = new URLSearchParams(params);
  if (isActive) {
    newParams.delete(paramKey);
  } else {
    newParams.set(paramKey, value);
  }
  return (
    <a
      href={`/buscar?${newParams.toString()}`}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${
        isActive
          ? "bg-teal-600 text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </a>
  );
}

async function SearchResults({
  query,
  state,
  sort,
  categoryFilter,
  fpOnly,
}: {
  query: string;
  state: StateCode;
  sort: string;
  categoryFilter: string | null;
  fpOnly: boolean;
}) {
  let result;
  try {
    result = await searchMedications(query, state);
  } catch {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">
          Erro ao buscar medicamentos. Tente novamente.
        </p>
      </div>
    );
  }

  let medications = result.medications;

  // Apply filters
  if (categoryFilter) {
    medications = medications.filter((m) => m.category === categoryFilter);
  }
  if (fpOnly) {
    medications = medications.filter(
      (m) => m.farmacia_popular || m.farmacia_popular_free
    );
  }

  // Apply sort (default "relevancia" preserves API order = best name match first)
  switch (sort) {
    case "nome":
      medications.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "economia":
      medications.sort(
        (a, b) => (b.savings_percentage ?? 0) - (a.savings_percentage ?? 0)
      );
      break;
    case "preco":
      medications.sort((a, b) => a.price - b.price);
      break;
    case "relevancia":
    default:
      // Keep API order (sorted by similarity_score DESC)
      break;
  }

  if (medications.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">
          Nenhum medicamento encontrado para &quot;{query}&quot;.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Tente buscar pelo principio ativo ou nome comercial.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {medications.length}{" "}
        {medications.length === 1 ? "resultado" : "resultados"} para &quot;
        {query}&quot;
      </p>
      <div className="space-y-3">
        {medications.map((med) => (
          <MedicationCard key={med.id} medication={med} />
        ))}
      </div>
    </div>
  );
}

function SearchLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      <span className="ml-2 text-sm text-gray-500">Buscando...</span>
    </div>
  );
}

export default async function BuscarPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const state = (params.estado || "SP") as StateCode;
  const sort = params.ordenar || "relevancia";
  const categoryFilter = params.tipo || null;
  const fpOnly = params.fp === "1";

  const urlParams = new URLSearchParams();
  if (query) urlParams.set("q", query);
  urlParams.set("estado", state);
  if (sort !== "relevancia") urlParams.set("ordenar", sort);
  if (categoryFilter) urlParams.set("tipo", categoryFilter);
  if (fpOnly) urlParams.set("fp", "1");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SearchBar initialQuery={query} initialState={state} />

      {query ? (
        <div className="mt-6">
          {/* Sort & Filter Bar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Ordenar:</span>
              <div className="flex gap-1.5">
                <SortButton
                  label="Relevancia"
                  value="relevancia"
                  current={sort}
                  params={urlParams}
                />
                <SortButton
                  label="Preco"
                  value="preco"
                  current={sort}
                  params={urlParams}
                />
                <SortButton
                  label="Economia"
                  value="economia"
                  current={sort}
                  params={urlParams}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Filtrar:</span>
              <div className="flex gap-1.5">
                <FilterButton
                  label="Generico"
                  value="generic"
                  paramKey="tipo"
                  current={categoryFilter}
                  params={urlParams}
                />
                <FilterButton
                  label="Referencia"
                  value="reference"
                  paramKey="tipo"
                  current={categoryFilter}
                  params={urlParams}
                />
                <FilterButton
                  label="Similar"
                  value="similar"
                  paramKey="tipo"
                  current={categoryFilter}
                  params={urlParams}
                />
                <a
                  href={`/buscar?${(() => {
                    const p = new URLSearchParams(urlParams);
                    if (fpOnly) p.delete("fp");
                    else p.set("fp", "1");
                    return p.toString();
                  })()}`}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                    fpOnly
                      ? "bg-teal-600 text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Heart className="h-3 w-3" />
                  Farm. Popular
                </a>
              </div>
            </div>
          </div>

          <Suspense fallback={<SearchLoading />}>
            <SearchResults
              query={query}
              state={state}
              sort={sort}
              categoryFilter={categoryFilter}
              fpOnly={fpOnly}
            />
          </Suspense>
        </div>
      ) : (
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Digite o nome do medicamento para comparar precos.
          </p>
        </div>
      )}
    </div>
  );
}
