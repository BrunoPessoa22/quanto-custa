import type { Metadata } from "next";
import Link from "next/link";
import {
  Pill,
  Tag,
  Building2,
  Package,
  Heart,
  MapPin,
  ArrowLeft,
  TrendingDown,
  Info,
} from "lucide-react";
import PriceTable from "@/components/PriceTable";
import AffiliateLinks from "@/components/AffiliateLinks";
import {
  getMedication,
  getTopMedications,
  type MedicationDetail,
  type MedicationWithPrice,
} from "@/lib/api";
import { BRAZILIAN_STATES, ICMS_BRACKETS } from "@/lib/constants";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const meds = await getTopMedications();
    return meds.map((m) => ({ slug: m.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const med = await getMedication(slug);
    const title = `${med.name} - Preco e Genericos`;
    const description = `Compare precos de ${med.name} (${med.active_ingredient}). ${
      med.category === "reference"
        ? "Encontre genericos ate 80% mais baratos."
        : `Generico de ${med.active_ingredient}.`
    } Dados oficiais da ANVISA.`;
    return {
      title,
      description,
      openGraph: { title, description },
    };
  } catch {
    return { title: "Medicamento" };
  }
}

function getCategoryLabel(category: string) {
  switch (category) {
    case "reference":
      return "Referencia";
    case "generic":
      return "Generico";
    case "similar":
      return "Similar";
    default:
      return category;
  }
}

function getCategoryStyle(category: string) {
  switch (category) {
    case "reference":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "generic":
      return "bg-green-50 text-green-700 border-green-200";
    case "similar":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function PriceByStateTable({
  medication,
}: {
  medication: MedicationDetail;
}) {
  const prices = medication.prices_by_state || [];

  if (prices.length === 0) {
    // Show estimated prices using ICMS brackets
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-700">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                ICMS
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                PMC Estimado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {BRAZILIAN_STATES.map((state) => (
              <tr key={state.code} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-900">
                    {state.code}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {state.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {ICMS_BRACKETS[state.code]}%
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                  --
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium text-gray-700">Estado</th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              ICMS
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-700">
              PMC
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prices.map((p) => {
            const state = BRAZILIAN_STATES.find((s) => s.code === p.state);
            return (
              <tr key={p.state} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-900">{p.state}</span>
                  {state && (
                    <span className="ml-2 text-xs text-gray-500">
                      {state.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">
                  {p.icms_rate}%
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                  {formatCurrency(p.pmc)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StructuredData({ medication }: { medication: MedicationDetail }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: medication.name,
    description: `${medication.name} - ${medication.active_ingredient} (${medication.presentation})`,
    brand: {
      "@type": "Brand",
      name: medication.manufacturer,
    },
    category: "Medication",
    offers: medication.prices_by_state?.length
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "BRL",
          lowPrice: Math.min(...medication.prices_by_state.map((p) => p.pmc)),
          highPrice: Math.max(...medication.prices_by_state.map((p) => p.pmc)),
          offerCount: medication.prices_by_state.length,
        }
      : undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function RemedioPage({ params }: PageProps) {
  const { slug } = await params;

  let medication: MedicationDetail;
  try {
    medication = await getMedication(slug);
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Pill className="mx-auto h-12 w-12 text-gray-300" />
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Medicamento nao encontrado
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          O medicamento que voce procura nao foi encontrado em nosso banco de
          dados.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a busca
        </Link>
      </div>
    );
  }

  const reference =
    medication.equivalents?.find((e) => e.category === "reference") || null;
  const alternatives =
    medication.equivalents?.filter((e) => e.id !== medication.id) || [];

  return (
    <>
      <StructuredData medication={medication} />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link
            href="/buscar"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a busca
          </Link>
        </nav>

        {/* Medication Header */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {medication.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${getCategoryStyle(medication.category)}`}
                >
                  <Tag className="h-3 w-3" />
                  {getCategoryLabel(medication.category)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Pill className="h-4 w-4 text-gray-400" />
                  {medication.active_ingredient}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {medication.manufacturer}
                </span>
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-gray-400" />
                  {medication.presentation}
                </span>
              </div>

              {(medication.farmacia_popular ||
                medication.farmacia_popular_free) && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">
                  <Heart className="h-4 w-4" />
                  {medication.farmacia_popular_free
                    ? "Disponivel GRATIS pelo Farmacia Popular"
                    : "Disponivel com desconto no Farmacia Popular"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price Comparison */}
        {alternatives.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <TrendingDown className="h-5 w-5 text-green-600" />
              Alternativas mais baratas
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Genericos e similares com o mesmo principio ativo (
              {medication.active_ingredient})
            </p>
            <div className="mt-4">
              <PriceTable reference={reference} equivalents={alternatives} />
            </div>
          </section>
        )}

        {/* Price by State */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MapPin className="h-5 w-5 text-teal-600" />
            Preco por estado
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            O PMC varia de acordo com a aliquota de ICMS de cada estado.
          </p>
          <div className="mt-4">
            <PriceByStateTable medication={medication} />
          </div>
        </section>

        {/* Buy Links */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">
            Onde comprar
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Busque {medication.name} nas principais farmacias online.
          </p>
          <div className="mt-4">
            <AffiliateLinks
              medicationId={medication.id}
              medicationName={medication.name}
            />
          </div>
        </section>

        {/* Disclaimer */}
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-500">
            Os precos exibidos sao o Preco Maximo ao Consumidor (PMC) definido
            pela CMED/ANVISA. O preco final pode ser menor dependendo da
            farmacia. Sempre consulte seu medico antes de trocar qualquer
            medicacao.
          </p>
        </div>

        {/* Related Medications */}
        {alternatives.length > 0 && (
          <section className="mt-8 border-t border-gray-100 pt-8">
            <h2 className="text-lg font-bold text-gray-900">
              Medicamentos relacionados
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {alternatives.slice(0, 6).map((med) => (
                <Link
                  key={med.id}
                  href={`/remedio/${med.slug}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {med.name}
                    </p>
                    <p className="text-xs text-gray-500">{med.manufacturer}</p>
                  </div>
                  <span className="ml-3 shrink-0 text-sm font-semibold text-gray-900">
                    {formatCurrency(med.price)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
